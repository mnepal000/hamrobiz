#!/usr/bin/env python3
"""Geocode HamroBiz listings via Nominatim (1 req/sec, polite UA).
Adds 'lat'/'lng' to listings that have a street address and no coords yet.
Listings with no street address are left unmapped (lat/lng = None)."""
import json, time, urllib.parse, urllib.request

DATA = '/home/hatch/workspace/hamrobiz/data/listings.json'
UA = 'HamroBiz/1.0 (https://mnepal000.github.io/hamrobiz/)'

def geocode(query):
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(
        {'q': query, 'format': 'json', 'limit': 1, 'countrycodes': 'us'})
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        results = json.loads(r.read().decode('utf-8'))
    if results:
        return float(results[0]['lat']), float(results[0]['lon'])
    return None, None

def main():
    listings = json.load(open(DATA))
    done, failed, skipped = 0, 0, 0
    for l in listings:
        if l.get('lat') and l.get('lng'):
            done += 1
            continue
        if not l.get('address'):
            l['lat'], l['lng'] = None, None
            skipped += 1
            continue
        q = ', '.join(x for x in [l['address'], l['city'], l['state'], l.get('zip','')] if x)
        try:
            lat, lng = geocode(q)
        except Exception as e:
            print(f"ERROR {l['id']} {l['name']}: {e}")
            lat, lng = None, None
        l['lat'], l['lng'] = lat, lng
        if lat:
            done += 1
            print(f"OK   {l['id']} {l['name'][:40]:42s} {lat:.4f},{lng:.4f}")
        else:
            failed += 1
            print(f"FAIL {l['id']} {l['name'][:40]}")
        time.sleep(1.2)
    json.dump(listings, open(DATA, 'w'), indent=2, ensure_ascii=False)
    print(f"\ndone: geocoded={done} failed={failed} skipped(no address)={skipped}")

if __name__ == '__main__':
    main()
