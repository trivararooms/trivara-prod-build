// Property location is restricted to Karnataka, India for now - see
// CreateListing.tsx's location step. Country/state are fixed single
// options; this is the city/town picker's option list, covering Bengaluru
// plus every district headquarters and a broad set of well-known towns
// across all 31 districts.
export const FIXED_COUNTRY = 'India';
export const FIXED_STATE = 'Karnataka';

export const KARNATAKA_CITIES: string[] = [
  'Afzalpur', 'Aland', 'Anekal', 'Ankola', 'Arsikere', 'Athani',
  'Bagalkot', 'Bagepalli', 'Bailhongal', 'Ballari', 'Bantwal', 'Basavakalyan',
  'Basavana Bagewadi', 'Belagavi', 'Belur', 'Bengaluru', 'Bengaluru Rural',
  'Bhadravati', 'Bhalki', 'Bhatkal', 'Bidar', 'Bijapur', 'Byndoor',
  'Chamarajanagar', 'Champapatna', 'Channagiri', 'Channapatna', 'Channarayapatna',
  'Chikkaballapur', 'Chikkamagaluru', 'Chikodi', 'Chincholi', 'Chintamani',
  'Chitapur', 'Chitradurga', 'Davanagere', 'Devanahalli', 'Dharwad',
  'Doddaballapura', 'Gadag', 'Gajendragad', 'Gangavathi', 'Gokak', 'Gubbi',
  'Gulbarga', 'Gundlupet', 'Harapanahalli', 'Harihar', 'Hassan', 'Haveri',
  'Holenarasipura', 'Honnali', 'Honnavar', 'Hosanagara', 'Hoskote', 'Hospet',
  'Hubballi', 'Humnabad', 'Hunsur', 'Ilkal', 'Indi', 'Jamkhandi', 'Jevargi',
  'Kalaburagi', 'Kalghatgi', 'Kampli', 'Kanakapura', 'Karkala', 'Karwar',
  'Kolar', 'Kollegal', 'Koppal', 'Krishnarajanagara', 'Kumta', 'Kundapura',
  'Kushalnagar', 'Kushtagi', 'Lingsugur', 'Madikeri', 'Magadi', 'Malur',
  'Mandya', 'Mangaluru', 'Manvi', 'Maski', 'Moodbidri', 'Mudalgi',
  'Muddebihal', 'Mudhol', 'Mulbagal', 'Mundgod', 'Mysuru', 'Nanjangud',
  'Nargund', 'Navalgund', 'Nelamangala', 'Nipani', 'Piriyapatna', 'Puttur',
  'Rabkavi Banhatti', 'Raichur', 'Ramanagara', 'Ramdurg', 'Ranebennur',
  'Robertsonpet', 'Ron', 'Sagara', 'Sakleshpur', 'Sedam', 'Shahapur',
  'Shikaripura', 'Shivamogga', 'Shorapur', 'Sidlaghatta', 'Sindagi',
  'Sindhanur', 'Sira', 'Siruguppa', 'Sirsi', 'Somwarpet', 'Sringeri',
  'Srinivaspur', 'Sullia', 'Talikote', 'Thirthahalli', 'Tiptur', 'Tumakuru',
  'Udupi', 'Vijayapura', 'Virajpet', 'Wadi', 'Yadgir', 'Yelahanka', 'Yellapur',
].sort((a, b) => a.localeCompare(b));
