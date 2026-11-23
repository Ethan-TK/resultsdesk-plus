#!/usr/bin/env python3
"""Add map coordinates to data/2026/*.json by matching each voting place's street address to LINZ's
NZ Addresses layer (CC BY 4.0, https://data.linz.govt.nz/layer/123113).

    python tools/add_coordinates.py <nz-addresses.csv> <general_electorates.json> <maori_electorates.json> data/2026

nz-addresses.csv  the CSV export of the LINZ layer (columns incl. full_road_name_ascii, address_number, shape_X/Y)
*_electorates     the site's electorate boundary files (GeoJSON, longitude/latitude); used to choose between
                  towns when a street name repeats, and to check the match
Run tools/build_local_data.py first (it rewrites the data files), then this, then node build.js.

Adds "xy" to each electorate file: one entry per place, [longitude, latitude, quality] or null.
quality 3 = street number found and the suburb or electorate agrees;
1 = street and suburb found but not that number (nearest number used).
Matches that nothing confirms (wrong town with the same street name) are dropped.
"""
import csv, glob, json, os, re, sys, unicodedata

ABBR = {'rd': 'road', 'ave': 'avenue', 'av': 'avenue', 'dr': 'drive', 'cres': 'crescent', 'pl': 'place', 'tce': 'terrace',
        'hwy': 'highway', 'cl': 'close', 'ct': 'court', 'pde': 'parade', 'esp': 'esplanade', 'blvd': 'boulevard',
        'ln': 'lane', 'sq': 'square', 'mt': 'mount', 'nth': 'north', 'sth': 'south'}


def ascii_lower(s):
    s = unicodedata.normalize('NFD', s)
    return ''.join(c for c in s if not unicodedata.combining(c)).lower()


def norm_road(s):
    toks = re.findall(r'[a-z0-9]+', ascii_lower(s).replace('&', ' and ').replace('’', '').replace("'", ''))
    out = []
    for i, t in enumerate(toks):
        if t == 'st':
            t = 'street' if i == len(toks) - 1 else 'saint'      # "Main St" vs "St Lukes Road"
        else:
            t = ABBR.get(t, t)
        out.append(t)
    return ' '.join(out)


def norm_words(s):
    return set(re.findall(r'[a-z0-9]+', ascii_lower(s)))


def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', ascii_lower(name)).strip('-')


NUM = re.compile(r'^(\d+)([A-Za-z]?)(?:\s*([-/])\s*(\d+)([A-Za-z]?))?\s+(\S.*)$')


def parse_place(name):
    """-> (locality, number, suffix, high, unit, street) or None if there is no street address."""
    if name.startswith('Taken in '):
        return None
    parts = [p.strip() for p in name.split(', ')]
    for part in reversed(parts[1:]):
        text = re.sub(r'\s*\(.*?\)\s*', ' ', part).strip()
        m = NUM.match(text)
        if not m:
            continue
        a, sa, sep, b, sb, street = m.groups()
        if sep == '/':
            number, suffix, high, unit = int(b), sb.upper(), None, a
        elif sep == '-':
            number, suffix, high, unit = int(a), sa.upper(), int(b), None
        else:
            number, suffix, high, unit = int(a), sa.upper(), None, None
        return parts[0], number, suffix, high, unit, street
    return None


def load_polygons(paths):
    polys = {}
    for p in paths:
        g = json.load(open(p, encoding='utf-8'))
        for ft in g['features']:
            pr = ft['properties']
            name = pr.get('electorate_name') or pr.get('MED2025_V1_00_NAME') or pr.get('name')
            geom = ft['geometry']
            polys_list = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
            shapes = []
            for poly in polys_list:
                xs = [pt[0] for pt in poly[0]]; ys = [pt[1] for pt in poly[0]]
                shapes.append((min(xs), min(ys), max(xs), max(ys), poly))
            polys[slug(name)] = shapes
    return polys


def in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]; xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def inside(shapes, x, y):
    for x0, y0, x1, y1, poly in shapes:
        if x0 <= x <= x1 and y0 <= y <= y1 and in_ring(x, y, poly[0]) and not any(in_ring(x, y, h) for h in poly[1:]):
            return True
    return False


def main():
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    csv_path, gen_path, mao_path, data_dir = sys.argv[1:]
    polys = load_polygons([gen_path, mao_path])
    files = [f for f in sorted(glob.glob(os.path.join(data_dir, '*.json'))) if not f.endswith('index.json')]
    elect = {}
    needed = set()
    for f in files:
        d = json.load(open(f, encoding='utf-8'))
        elect[f] = d
        for p in d['places']:
            parsed = parse_place(p[0])
            if parsed:
                needed.add(norm_road(parsed[5]))
    print(f'{len(files)} electorates, {len(needed)} distinct street names to find')

    index = {k: [] for k in needed}
    cache = {}
    rows = 0
    with open(csv_path, encoding='utf-8-sig', newline='') as fh:
        rd = csv.reader(fh)
        head = next(rd)
        ix = {h: i for i, h in enumerate(head)}
        iR, iN, iS, iH, iU = ix['full_road_name_ascii'], ix['address_number'], ix['address_number_suffix'], ix['address_number_high'], ix['unit']
        iSub, iTown, iX, iY = ix['suburb_locality_ascii'], ix['town_city_ascii'], ix['shape_X'], ix['shape_Y']
        for row in rd:
            rows += 1
            rn = row[iR]
            k = cache.get(rn)
            if k is None:
                k = cache[rn] = norm_road(rn)
            if k in index and row[iN]:
                index[k].append((int(row[iN]), row[iS].upper(), int(row[iH]) if row[iH] else None, row[iU],
                                 norm_words(row[iSub]), norm_words(row[iTown]), float(row[iX]), float(row[iY])))
    print(f'read {rows:,} addresses; kept {sum(len(v) for v in index.values()):,} on the streets we need')

    stats = {'places': 0, 'no_address': 0, 'matched': 0, 'q3': 0, 'q1': 0, 'unmatched': 0, 'in_own': 0, 'out_own': 0}
    unmatched = []
    for f, d in elect.items():
        shapes = polys.get(slug(d['name']))
        xy = []
        for p in d['places']:
            stats['places'] += 1
            parsed = parse_place(p[0])
            if not parsed:
                stats['no_address'] += 1; xy.append(None); continue
            loc, number, suffix, high, unit, street = parsed
            cands = index.get(norm_road(street), [])
            lw = norm_words(loc)

            def score(c):
                s = 0
                if lw and (lw & c[4] or lw & c[5]): s += 2
                if shapes and inside(shapes, c[6], c[7]): s += 4
                return s
            exact = [c for c in cands if c[0] == number and (not suffix or c[1] == suffix)]
            if not exact and high:
                exact = [c for c in cands if c[0] == number or c[0] == high or (c[2] and c[0] <= number <= c[2])]
            if not exact:
                exact = [c for c in cands if c[0] == number]       # ignore a suffix that LINZ does not have
            quality = 0
            if exact:
                best = max(exact, key=lambda c: (score(c), c[3] == ''))
                if score(best) > 0:
                    quality = 3                      # that number on that street, in this suburb / electorate
            if not quality and cands:
                scored = [(score(c), -abs(c[0] - number), c) for c in cands]
                top = max(scored, key=lambda t: (t[0], t[1]))
                if top[0] > 0:
                    best = top[2]; quality = 1       # right street and suburb, nearest street number
            # a number match that neither the suburb nor the electorate agrees with is usually a different town: dropped
            if not quality:
                stats['unmatched'] += 1; unmatched.append(f'{d["name"]}: {p[0]}'); xy.append(None); continue
            stats['matched'] += 1; stats['q%d' % quality] += 1
            if shapes:
                stats['in_own' if inside(shapes, best[6], best[7]) else 'out_own'] += 1
            xy.append([round(best[6], 5), round(best[7], 5), quality])
        d['xy'] = xy
    for f, d in elect.items():
        json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(json.dumps(stats))
    with_addr = stats['places'] - stats['no_address']
    print(f"places with a street address: {with_addr}; matched {stats['matched']} ({100 * stats['matched'] / with_addr:.1f}%); "
          f"quality 3/1 = {stats['q3']}/{stats['q1']}")
    print(f"matched points inside their own electorate: {stats['in_own']} ({100 * stats['in_own'] / max(1, stats['matched']):.1f}%)")
    print('sample unmatched:'); [print('  ', u) for u in unmatched[:12]]


main()
