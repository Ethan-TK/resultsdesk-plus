#!/usr/bin/env python3
"""Build data/2026/*.json (results by voting place) from the Electoral Commission's per-electorate PDFs.

The Commission publishes one PDF per electorate ("Party Vote Details" + "Candidate Vote Details" by voting
place) on electionresults.govt.nz. Download them in your browser into one folder, then:

    pip install pymupdf
    python tools/build_local_data.py <folder with the 71 PDFs> <results-bundle.json> data/2026

<results-bundle.json> is the live results file the site itself loads (open resultsdesk.nz with the browser's
Network tab and save `results-bundle.json`). It is used to attach each column to a party / candidate and to
check that every electorate's PDF totals agree with the live totals. Nothing is written if the check fails.
"""
import glob, html, json, os, re, sys, unicodedata, warnings
warnings.filterwarnings('ignore')
import pymupdf

NUM = re.compile(r'-?\d[\d,]*')
SECTIONS = ['Advance Voting Places', 'Voting Places']   # 0 = advance, 1 = election day

# PDF party column (accents are lost in the PDFs) -> feed party number -> the site's own party key
def _letters(s):
    return re.sub(r'[^A-Za-z]', '', unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode()).upper()


LETTERS_TO_PNO = {}   # filled below once PDF_PARTY_TO_PNO exists
PDF_PARTY_TO_PNO = {
    'ACT New Zealand': 5, 'Alliance Party': 68, 'Animal Justice Party Aotearoa New Zealand': 52,
    'Aotearoa Legalise Cannabis Party': 36, 'Conservative Party NZ': 34, 'Free Palestine': 69,
    'Green Party': 10, 'Labour Party': 13, 'National Party': 16, 'New Zealand First Party': 17,
    'New Zealand Loyal': 70, 'NZ Outdoors & Freedom Party': 20, 'Opportunity Party': 24,
    'Te Pati Maori': 14, 'Te Tai Tokerau Party': 71, 'Vision New Zealand': 66, 'Womens Rights Party': 56,
}
PNO_TO_KEY = {
    5: 'ACT NEW ZEALAND', 68: 'ALLIANCE PARTY', 52: 'ANIMAL JUSTICE PARTY', 36: 'AOTEAROA LEGALISE CANNABIS PARTY',
    34: 'CONSERVATIVE PARTY NZ', 69: 'FREE PALESTINE', 10: 'GREEN PARTY', 13: 'LABOUR PARTY', 16: 'NATIONAL PARTY',
    17: 'NEW ZEALAND FIRST PARTY', 70: 'NEW ZEALAND LOYAL', 20: 'NZ OUTDOORS & FREEDOM PARTY',
    24: 'THE OPPORTUNITIES PARTY (TOP)', 14: 'TE PĀTI MĀORI', 71: 'TE TAI TOKERAU PARTY', 66: 'VISION NEW ZEALAND',
    56: 'WOMEN’S RIGHTS PARTY',
}


def clean(s):
    # The PDFs draw a macron as a separate '¯' before the vowel: put it back on the letter.
    s = re.sub('[¯�]ı', 'ī', s)        # macron + dotless i -> ī
    s = re.sub('[¯�]([AEIOUaeiou])', lambda m: unicodedata.normalize('NFC', m.group(1) + '̄'), s)
    return re.sub(r'\s+', ' ', s.replace('�', '').replace('¯', '')).strip()


def slug(name):
    s = unicodedata.normalize('NFD', name)
    s = ''.join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def ascii_letters(s):
    return re.sub(r'[^A-Za-z]', '', unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode()).upper()


def page_lines(page):
    out = []
    for b in page.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            t = ''.join(s['text'] for s in l['spans']).strip()
            if t:
                x0, y0, x1, y1 = l['bbox']
                d = l.get('dir', (1, 0))
                out.append({'t': t, 'x0': x0, 'y0': y0, 'x1': x1, 'v': abs(d[1]) > 0.5})
    return out


def parse_pdf(path):
    no = int(re.match(r'(\d+)_', os.path.basename(path)).group(1))
    doc = pymupdf.open(path)
    name, produced, kind_label = None, None, None
    tables = {k: {'cols': None, 'places': [], 'total': None} for k in ('party', 'cand')}
    kind = None
    for page in doc:
        ls = page_lines(page)
        horiz = [l for l in ls if not l['v']]
        vert = sorted((l for l in ls if l['v']), key=lambda l: l['x0'])
        for l in horiz:
            if l['t'] == 'Party Vote Details': kind = 'party'
            elif l['t'] == 'Candidate Vote Details': kind = 'cand'
            elif name is None and re.match(r'^\d{2} ', l['t']): name = clean(l['t'][3:])
            m = re.match(r'Produced: (\S+ \S+)', l['t'])
            if m: produced = m.group(1)
            m = re.match(r'\(2026 General Election, (.+)\)$', l['t'])
            if m: kind_label = m.group(1)           # e.g. 'Preliminary Results' or 'Official Results'
        if kind is None:
            continue
        tb = tables[kind]
        if vert and tb['cols'] is None:
            tb['cols'] = [clean(l['t']) for l in vert]        # last one is the 'Informal ...' column
        need = 15 if kind == 'party' else 5
        nums = sorted((l for l in horiz if NUM.fullmatch(l['t'])), key=lambda l: l['y0'])
        rows = []
        for l in nums:
            if rows and abs(l['y0'] - rows[-1]['y']) <= 0.8: rows[-1]['n'].append(l)
            else: rows.append({'y': l['y0'], 'n': [l], 'name': []})
        rows = [r for r in rows if len(r['n']) >= need]
        texts = sorted((l for l in horiz if not NUM.fullmatch(l['t']) and l['x0'] < 300 and not re.match(
            r'^(Source:|Produced:|Note:|\(2026 |\d{2} |Party Vote Details|Candidate Vote Details|Total$|Valid$|Party$|Candidate$|Votes$)', l['t'])),
            key=lambda l: l['y0'])
        heads = sorted((l['y0'], SECTIONS.index(clean(l['t']))) for l in texts if clean(l['t']) in SECTIONS)
        last = None
        for l in texts:
            t = clean(l['t'])
            if t in SECTIONS: continue
            best = next((r for r in rows if abs(r['y'] - l['y0']) <= 2.4), None)
            if best is None and last is not None and 0 < l['y0'] - last['y'] < 22: best = last   # wrapped name
            if best is not None:
                best['name'].append(t); last = best
        for r in rows:
            sec = None
            for hy, hs in heads:
                if hy < r['y']: sec = hs
            vals = [int(x['t'].replace(',', '')) for x in sorted(r['n'], key=lambda x: x['x0'])]
            nm = ' '.join(r['name']).strip()
            row = {'n': nm, 's': sec, 'v': vals[:-2], 't': vals[-2], 'i': vals[-1]}
            if re.search(r'\bTOTAL$', nm):
                tb['total'] = row
            else:
                if row['s'] is None: row['s'] = tb['places'][-1]['s'] if tb['places'] else 0
                tb['places'].append(row)
    return no, name, produced, kind_label, tables


def bundle_tables(bundle):
    parties_xml = bundle['references']['parties']
    cands_xml = bundle['references']['candidates']
    cand_party = {int(c): int(p) for c, p in re.findall(r'<candidate c_no="(\d+)">.*?<party>(\d+)</party>', cands_xml, re.S)}
    cand_name = {int(c): n for c, n in re.findall(r'<candidate c_no="(\d+)">\s*<candidate_name>([^<]*)</candidate_name>', cands_xml)}
    party_name = {int(n): html.unescape(v) for n, v in re.findall(r'<party p_no="(\d+)">.*?<party_name>([^<]*)</party_name>', parties_xml, re.S)}
    out = {}
    for x in bundle['electorates'].values():
        no = int(re.search(r'e_no="(\d+)"', x).group(1))
        pv_part, cv_part = x.split('<candidatevotes>')
        pv = {int(p): int(v) for p, v in re.findall(r'<party p_no="(\d+)">\s*<votes>(\d+)</votes>', pv_part)}
        cv = {int(c): int(v) for c, v in re.findall(r'<candidate c_no="(\d+)">\s*<votes>(\d+)</votes>', cv_part)}
        out[no] = {'pv': pv, 'cv': cv,
                   'ip': int(re.search(r'<total_party_informals>(\d+)', x).group(1)),
                   'ic': int(re.search(r'<total_candidate_informals>(\d+)', x).group(1))}
    return out, cand_party, cand_name, party_name


LETTERS_TO_PNO.update({_letters(k): v for k, v in PDF_PARTY_TO_PNO.items()})


def main():
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    pdf_dir, bundle_path, out_dir = sys.argv[1:]
    bundle = json.load(open(bundle_path, encoding='utf-8'))
    live, cand_party, cand_name, party_name = bundle_tables(bundle)
    files = sorted(glob.glob(os.path.join(pdf_dir, '[0-9][0-9]_*.pdf')))
    problems, built, index = [], {}, {}
    for f in files:
        no, name, produced, kind_label, T = parse_pdf(f)
        P, C, L = T['party'], T['cand'], live.get(no)
        tag = f'{no:02d} {name}'
        if not L or not P['total'] or not C['total']:
            problems.append(f'{tag}: missing data'); continue
        # party columns -> site keys, then check each party's total against the live feed
        pcols = P['cols'][:-1]
        pnos = [LETTERS_TO_PNO.get(_letters(c)) for c in pcols]
        if None in pnos:
            problems.append(f'{tag}: unknown party column {[c for c, p in zip(pcols, pnos) if p is None]}'); continue
        for pno, v in zip(pnos, P['total']['v']):
            if L['pv'].get(pno, 0) != v: problems.append(f'{tag}: party {pno} total {v} != live {L["pv"].get(pno)}')
        if P['total']['i'] != L['ip']: problems.append(f'{tag}: party informal mismatch')
        if C['total']['i'] != L['ic']: problems.append(f'{tag}: candidate informal mismatch')
        if sum(p['t'] for p in P['places']) != P['total']['t']: problems.append(f'{tag}: party places do not sum to TOTAL')
        if sum(p['t'] for p in C['places']) != C['total']['t']: problems.append(f'{tag}: candidate places do not sum to TOTAL')
        if len(P['places']) != len(C['places']): problems.append(f'{tag}: party/candidate place counts differ')
        # candidate columns -> party, by matching each column's TOTAL to the live candidate vote totals
        ccols = C['cols'][:-1]
        free = dict(L['cv'])
        cands = []
        for col, v in zip(ccols, C['total']['v']):
            hits = [c for c, vv in free.items() if vv == v]
            party = -1          # -1 = could not tell, 0 = independent
            if len(hits) == 1:
                party = cand_party.get(hits[0]); del free[hits[0]]
            elif len(hits) > 1:
                # tied totals (e.g. two candidates on the same number): tell them apart by surname
                sur = ascii_letters(col.split(',')[0])
                same = [c for c in hits if ascii_letters(cand_name.get(c, '').split(',')[0]) == sur]
                if len(same) == 1:
                    party = cand_party.get(same[0]); del free[same[0]]
            key = None if party == -1 else ('INDEPENDENT' if party == 0 else PNO_TO_KEY.get(party) or party_name.get(party, '').upper() or None)
            cands.append({'p': key, 's': ascii_letters(col.split(',')[0])})
        if any(sum(c['v'] for c in []) for c in []): pass
        key = slug(name)
        if key in index: problems.append(f'{tag}: duplicate slug {key}')
        index[key] = no
        places = []
        for pp, cp in zip(P['places'], C['places']):
            if pp['n'] != cp['n']: problems.append(f'{tag}: place name mismatch {pp["n"][:30]!r} / {cp["n"][:30]!r}')
            places.append([pp['n'], pp['s'], pp['v'], cp['v'], pp['i'], cp['i']])
        built[key] = {'no': no, 'name': name, 'produced': produced, 'kind': kind_label, 'parties': [PNO_TO_KEY[p] for p in pnos], 'cands': cands, 'places': places}
    print(f'{len(built)} electorates built from {len(files)} PDFs')
    if len(files) != 71: problems.append(f'expected 71 PDFs, found {len(files)}')
    if problems:
        print('PROBLEMS (nothing written):'); [print(' ', p) for p in problems[:40]]
        sys.exit(1)
    os.makedirs(out_dir, exist_ok=True)
    for key, d in built.items():
        json.dump(d, open(os.path.join(out_dir, key + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    json.dump({'source': 'Electoral Commission, 2026 General Election preliminary results',
               'electorates': index}, open(os.path.join(out_dir, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    size = sum(os.path.getsize(os.path.join(out_dir, f)) for f in os.listdir(out_dir))
    print(f'wrote {len(built) + 1} files to {out_dir} ({size / 1024:.0f} KB total)')


main()
