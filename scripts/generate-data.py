#!/usr/bin/env python3
"""
Generate a synthetic but realistic dataset of 5,000 commercial properties
across Berlin's 12 Bezirke. Output: SQLite file at public/data/berlin-cre.sqlite
"""
import sqlite3
import random
import json
import os
import math
from pathlib import Path

random.seed(42)

# District profiles (from MarketPulse data)
DISTRICTS = {
    'Mitte': {
        'centroid': (52.5200, 13.4050),
        'spread': 0.025,
        'rent_base': 22.0,
        'office_weight': 0.55, 'retail_weight': 0.25,
        'logistics_weight': 0.05, 'mixed_weight': 0.15,
        'avg_vacancy': 6.0, 'postcodes': ['10115', '10117', '10119', '10178', '10179'],
    },
    'Friedrichshain-Kreuzberg': {
        'centroid': (52.5050, 13.4350),
        'spread': 0.022,
        'rent_base': 19.5,
        'office_weight': 0.50, 'retail_weight': 0.22,
        'logistics_weight': 0.08, 'mixed_weight': 0.20,
        'avg_vacancy': 5.5, 'postcodes': ['10243', '10245', '10247', '10961', '10967', '10969', '10997'],
    },
    'Pankow': {
        'centroid': (52.5680, 13.4030),
        'spread': 0.040,
        'rent_base': 15.5,
        'office_weight': 0.35, 'retail_weight': 0.25,
        'logistics_weight': 0.10, 'mixed_weight': 0.30,
        'avg_vacancy': 7.5, 'postcodes': ['10405', '10407', '10437', '13156', '13187', '13189'],
    },
    'Charlottenburg-Wilmersdorf': {
        'centroid': (52.5050, 13.2980),
        'spread': 0.030,
        'rent_base': 18.0,
        'office_weight': 0.45, 'retail_weight': 0.30,
        'logistics_weight': 0.05, 'mixed_weight': 0.20,
        'avg_vacancy': 7.0, 'postcodes': ['10623', '10707', '10709', '10711', '14059'],
    },
    'Spandau': {
        'centroid': (52.5400, 13.2000),
        'spread': 0.035,
        'rent_base': 11.0,
        'office_weight': 0.20, 'retail_weight': 0.20,
        'logistics_weight': 0.40, 'mixed_weight': 0.20,
        'avg_vacancy': 10.0, 'postcodes': ['13581', '13583', '13585', '13589', '13593'],
    },
    'Steglitz-Zehlendorf': {
        'centroid': (52.4400, 13.2500),
        'spread': 0.040,
        'rent_base': 14.5,
        'office_weight': 0.30, 'retail_weight': 0.35,
        'logistics_weight': 0.10, 'mixed_weight': 0.25,
        'avg_vacancy': 8.0, 'postcodes': ['12163', '12165', '12167', '14169', '14195'],
    },
    'Tempelhof-Schöneberg': {
        'centroid': (52.4730, 13.3700),
        'spread': 0.028,
        'rent_base': 16.0,
        'office_weight': 0.40, 'retail_weight': 0.28,
        'logistics_weight': 0.12, 'mixed_weight': 0.20,
        'avg_vacancy': 7.2, 'postcodes': ['10777', '10781', '10825', '12099', '12101', '12103'],
    },
    'Neukölln': {
        'centroid': (52.4700, 13.4360),
        'spread': 0.030,
        'rent_base': 15.0,
        'office_weight': 0.30, 'retail_weight': 0.30,
        'logistics_weight': 0.15, 'mixed_weight': 0.25,
        'avg_vacancy': 8.5, 'postcodes': ['12043', '12045', '12047', '12049', '12053', '12057'],
    },
    'Treptow-Köpenick': {
        'centroid': (52.4500, 13.5800),
        'spread': 0.050,
        'rent_base': 13.0,
        'office_weight': 0.30, 'retail_weight': 0.18,
        'logistics_weight': 0.35, 'mixed_weight': 0.17,
        'avg_vacancy': 9.0, 'postcodes': ['12435', '12437', '12459', '12489', '12555'],
    },
    'Marzahn-Hellersdorf': {
        'centroid': (52.5400, 13.6100),
        'spread': 0.035,
        'rent_base': 9.5,
        'office_weight': 0.15, 'retail_weight': 0.25,
        'logistics_weight': 0.45, 'mixed_weight': 0.15,
        'avg_vacancy': 12.0, 'postcodes': ['12619', '12679', '12681', '12683', '12685', '12687'],
    },
    'Lichtenberg': {
        'centroid': (52.5100, 13.5000),
        'spread': 0.028,
        'rent_base': 12.5,
        'office_weight': 0.25, 'retail_weight': 0.22,
        'logistics_weight': 0.28, 'mixed_weight': 0.25,
        'avg_vacancy': 9.5, 'postcodes': ['10315', '10317', '10318', '10367', '10369'],
    },
    'Reinickendorf': {
        'centroid': (52.5900, 13.3300),
        'spread': 0.035,
        'rent_base': 12.0,
        'office_weight': 0.22, 'retail_weight': 0.23,
        'logistics_weight': 0.35, 'mixed_weight': 0.20,
        'avg_vacancy': 10.5, 'postcodes': ['13403', '13405', '13407', '13469', '13507', '13509'],
    },
}

STREETS = [
    'Hauptstraße', 'Schlossstraße', 'Friedrichstraße', 'Kantstraße', 'Müllerstraße',
    'Frankfurter Allee', 'Karl-Marx-Straße', 'Sonnenallee', 'Tempelhofer Damm', 'Bismarckstraße',
    'Kurfürstendamm', 'Potsdamer Straße', 'Greifswalder Straße', 'Schönhauser Allee', 'Kaiserdamm',
    'Lindenstraße', 'Mariendorfer Damm', 'Tegeler Straße', 'Konrad-Wolf-Straße', 'Treskowallee',
    'Adalbertstraße', 'Köpenicker Straße', 'Wilhelmstraße', 'Leipziger Straße', 'Französische Straße',
    'Mohrenstraße', 'Behrenstraße', 'Charlottenstraße', 'Markgrafenstraße', 'Jägerstraße',
]

TYPES = ['office', 'retail', 'logistics', 'mixed']
ENERGY_CLASSES = ['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G']
CERTIFICATIONS = ['BNB Gold', 'BNB Silver', 'BNB Bronze', 'LEED Gold', 'LEED Platinum', 'DGNB Gold', 'none', 'none', 'none', 'none']

def weighted_choice(weights_dict):
    items = list(weights_dict.items())
    total = sum(w for _, w in items)
    r = random.uniform(0, total)
    upto = 0
    for k, w in items:
        upto += w
        if r <= upto:
            return k
    return items[-1][0]

def generate_property(idx, district_name, district):
    # Geo: centroid + gaussian noise within spread (~5km radius typical)
    lat = district['centroid'][0] + random.gauss(0, district['spread'])
    lng = district['centroid'][1] + random.gauss(0, district['spread'])

    # Property type by district weights
    type_weights = {
        'office': district['office_weight'],
        'retail': district['retail_weight'],
        'logistics': district['logistics_weight'],
        'mixed': district['mixed_weight'],
    }
    ptype = weighted_choice(type_weights)

    # Size depends on type (log-normal-ish)
    if ptype == 'logistics':
        size = int(random.lognormvariate(7.8, 0.6))  # ~2400-15000 sqm typical
    elif ptype == 'office':
        size = int(random.lognormvariate(6.8, 0.7))
    elif ptype == 'retail':
        size = int(random.lognormvariate(6.0, 0.6))
    else:  # mixed
        size = int(random.lognormvariate(6.5, 0.7))
    size = max(50, min(size, 50000))

    # Year built (older skews toward central districts)
    central = district_name in ('Mitte', 'Friedrichshain-Kreuzberg', 'Charlottenburg-Wilmersdorf')
    if central:
        year_built = random.choices(
            [random.randint(1880, 1939), random.randint(1949, 1989), random.randint(1990, 2024)],
            weights=[0.35, 0.30, 0.35],
        )[0]
    else:
        year_built = random.choices(
            [random.randint(1950, 1989), random.randint(1990, 2010), random.randint(2011, 2024)],
            weights=[0.30, 0.40, 0.30],
        )[0]

    # Rent: base × type modifier × age modifier
    type_modifier = {'office': 1.0, 'retail': 1.10, 'logistics': 0.55, 'mixed': 0.95}[ptype]
    age_modifier = 1.0 + (year_built - 2000) / 250.0  # newer = pricier
    rent = district['rent_base'] * type_modifier * age_modifier * random.uniform(0.85, 1.15)
    rent = round(rent, 1)

    # Vacancy (normal around district avg)
    vacancy = max(0, min(40, random.gauss(district['avg_vacancy'], 3)))
    vacancy = round(vacancy, 1)

    # Energy class (newer = better)
    if year_built >= 2010:
        ec = random.choices(['A+', 'A', 'B', 'C'], [0.10, 0.35, 0.40, 0.15])[0]
    elif year_built >= 1990:
        ec = random.choices(['A', 'B', 'C', 'D', 'E'], [0.05, 0.25, 0.35, 0.25, 0.10])[0]
    else:
        ec = random.choices(['C', 'D', 'E', 'F', 'G'], [0.10, 0.30, 0.30, 0.20, 0.10])[0]

    # Certification (favors newer + larger)
    if year_built >= 2010 and size > 3000:
        cert = random.choice(['BNB Gold', 'BNB Silver', 'LEED Gold', 'LEED Platinum', 'DGNB Gold', 'none', 'none'])
    elif year_built >= 2000 and size > 1500:
        cert = random.choice(['BNB Silver', 'BNB Bronze', 'none', 'none', 'none', 'none'])
    else:
        cert = 'none'

    # Tenant count (more for mixed/retail, fewer for logistics)
    if ptype == 'logistics':
        tenants = random.randint(1, 3)
    elif ptype == 'retail':
        tenants = random.randint(1, 8)
    elif ptype == 'office':
        tenants = random.randint(1, max(2, size // 600))
    else:
        tenants = random.randint(2, max(3, size // 400))

    street = random.choice(STREETS)
    number = random.randint(1, 200)
    address = f"{street} {number}"
    postcode = random.choice(district['postcodes'])

    return (
        idx, address, district_name, postcode,
        round(lat, 6), round(lng, 6),
        ptype, size, year_built, rent, vacancy, ec, cert, tenants
    )

def main():
    out_dir = Path(__file__).parent.parent / 'public' / 'data'
    out_dir.mkdir(parents=True, exist_ok=True)
    db_path = out_dir / 'berlin-cre.sqlite'
    if db_path.exists():
        db_path.unlink()

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute('''
        CREATE TABLE properties (
            id INTEGER PRIMARY KEY,
            address TEXT NOT NULL,
            district TEXT NOT NULL,
            postcode TEXT NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            property_type TEXT NOT NULL,
            size_sqm INTEGER NOT NULL,
            year_built INTEGER NOT NULL,
            rent_eur_sqm REAL NOT NULL,
            vacancy_percent REAL NOT NULL,
            energy_class TEXT NOT NULL,
            certification TEXT NOT NULL,
            tenant_count INTEGER NOT NULL
        )
    ''')

    # Indices for common query columns
    cur.execute('CREATE INDEX idx_district ON properties(district)')
    cur.execute('CREATE INDEX idx_type ON properties(property_type)')
    cur.execute('CREATE INDEX idx_year ON properties(year_built)')

    rows = []
    district_names = list(DISTRICTS.keys())
    for i in range(1, 5001):
        district_name = random.choices(
            district_names,
            weights=[35, 30, 40, 33, 24, 30, 35, 33, 28, 22, 30, 26],  # rough population weights
        )[0]
        rows.append(generate_property(i, district_name, DISTRICTS[district_name]))

    cur.executemany(
        'INSERT INTO properties VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        rows,
    )
    conn.commit()

    cur.execute('SELECT COUNT(*) FROM properties')
    n = cur.fetchone()[0]
    print(f"Inserted {n} properties.")

    cur.execute('SELECT district, COUNT(*) FROM properties GROUP BY district ORDER BY 2 DESC')
    print("\nBy district:")
    for d, c in cur.fetchall():
        print(f"  {d}: {c}")

    cur.execute('SELECT property_type, COUNT(*), AVG(rent_eur_sqm), AVG(size_sqm) FROM properties GROUP BY property_type ORDER BY 2 DESC')
    print("\nBy type:")
    for t, c, ar, ass in cur.fetchall():
        print(f"  {t}: {c}  avg rent €{ar:.1f}/m²  avg size {ass:.0f}m²")

    conn.close()
    print(f"\n✓ Database written to {db_path} ({db_path.stat().st_size / 1024:.1f} KB)")

if __name__ == '__main__':
    main()
