#!/usr/bin/env python3
"""Poll the UPSC website for newly uploaded PDFs and search them for a name / roll number.

Usage:  python3 upsc_watch.py [--interval 1] [--scan-existing]

Output (one event per line, so it can be piped to a notifier):
  NEW_PDF <url>            a PDF that was not seen before (listed as UPSC uploads it)
  MATCH   <url> <terms>    a PDF containing the name or roll number
  CONGRATULATIONS ...      printed together with MATCH
  WARN    <url> ...        PDF has no text layer (scanned) - check by hand

Matching PDFs are saved to ./matches/. State is kept in ./upsc_state.json.
One HTTP request is made per interval, rotating through the listing pages,
and each PDF is downloaded only once.
"""
import argparse, html, io, json, os, re, subprocess, sys, tempfile, time
import urllib.parse
import requests

BASE = "https://www.upsc.gov.in"
LISTING_PAGES = ["/", "/whats-new", "/final-results", "/written-results-"]
TERMS = [r"lubhna", r"5811053"]          # case-insensitive
HERE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(HERE, "upsc_state.json")
MATCH_DIR = os.path.join(HERE, "matches")
UA = {"User-Agent": "Mozilla/5.0 (personal result checker)"}
HREF = re.compile(r'''(?:href|src)\s*=\s*["']([^"']+)["']''', re.I)

sess = requests.Session()
sess.headers.update(UA)


def log(*a):
    print(*a, flush=True)


def load_state():
    try:
        with open(STATE) as f:
            return json.load(f)
    except Exception:
        return {"pdfs": [], "pages": [], "init": False}


def save_state(st):
    tmp = STATE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(st, f)
    os.replace(tmp, STATE)


def links(page_html, page_url):
    out = set()
    for raw in HREF.findall(page_html):
        u = urllib.parse.urljoin(page_url, html.unescape(raw.strip()))
        if urllib.parse.urlparse(u).netloc.replace("www.", "") != "upsc.gov.in":
            continue
        out.add(u.split("#")[0])
    return out


def is_pdf(u):
    return urllib.parse.urlparse(u).path.lower().endswith(".pdf")


def fetch(url, timeout=25):
    try:
        r = sess.get(url, timeout=timeout)
        if r.status_code == 200:
            return r
    except requests.RequestException:
        pass
    return None


def pdf_text(data):
    with tempfile.NamedTemporaryFile(suffix=".pdf") as t:
        t.write(data)
        t.flush()
        p = subprocess.run(["pdftotext", "-layout", t.name, "-"], capture_output=True, timeout=120)
    return p.stdout.decode("utf-8", "ignore")


def check_pdf(url, st):
    r = fetch(url, timeout=90)
    if r is None:
        return False  # retry later
    text = pdf_text(r.content)
    hits = [t for t in TERMS if re.search(t, text, re.I)]
    if hits:
        os.makedirs(MATCH_DIR, exist_ok=True)
        path = os.path.join(MATCH_DIR, os.path.basename(urllib.parse.urlparse(url).path))
        with open(path, "wb") as f:
            f.write(r.content)
        log(f"MATCH {url} terms={hits} saved={path}")
        log("CONGRATULATIONS! You passed! 🎉 Found in: " + url)
    elif len(text.strip()) < 50:
        log(f"WARN {url} has no text layer (scanned image?) - check manually")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--interval", type=float, default=1.0)
    ap.add_argument("--scan-existing", action="store_true",
                    help="also scan PDFs that are already on the site at start-up")
    args = ap.parse_args()

    st = load_state()
    seen_pdfs, seen_pages = set(st["pdfs"]), set(st["pages"])
    pending_pages, pending_pdfs = [], []
    first_run = not st["init"]
    log(f"watching {BASE} every {args.interval}s for {TERMS}")
    i = 0
    while True:
        t0 = time.time()
        try:
            # 1) cheap work first: queued PDFs / sub-pages, one request per tick
            if pending_pdfs:
                u = pending_pdfs.pop(0)
                if check_pdf(u, st):
                    seen_pdfs.add(u)
                else:
                    pending_pdfs.append(u)
            elif pending_pages:
                u = pending_pages.pop(0)
                r = fetch(u)
                if r is None:
                    pending_pages.append(u)
                elif "pdf" in r.headers.get("Content-Type", "").lower():
                    pending_pdfs.append(u)
                else:
                    seen_pages.add(u)
                    for l in links(r.text, u):
                        if is_pdf(l) and l not in seen_pdfs and l not in pending_pdfs:
                            log(f"NEW_PDF {l}")
                            pending_pdfs.append(l)
            else:
                # 2) rotate over listing pages
                page = BASE + LISTING_PAGES[i % len(LISTING_PAGES)]
                i += 1
                r = fetch(page)
                if r is not None:
                    for l in links(r.text, page):
                        if is_pdf(l):
                            if l not in seen_pdfs and l not in pending_pdfs:
                                if first_run and not args.scan_existing:
                                    seen_pdfs.add(l)
                                else:
                                    log(f"NEW_PDF {l}")
                                    pending_pdfs.append(l)
                        elif "/whats-new/" in l or "result" in l.lower():
                            if l not in seen_pages and l not in pending_pages:
                                if first_run and not args.scan_existing:
                                    seen_pages.add(l)
                                else:
                                    pending_pages.append(l)
                    if i >= len(LISTING_PAGES):
                        first_run = False
                        st["init"] = True
            st["pdfs"], st["pages"] = sorted(seen_pdfs), sorted(seen_pages)
            save_state(st)
        except Exception as e:  # never die
            log(f"ERR {type(e).__name__}: {e}")
        time.sleep(max(0, args.interval - (time.time() - t0)))


if __name__ == "__main__":
    sys.exit(main())
