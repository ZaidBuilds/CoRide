import { MetroLine, MetroStation } from '../types';

export const DELHI_METRO_LINES: MetroLine[] = [
  {
    id: 'blue',
    name: 'Blue Line',
    color: '#0284c7',
    accentColor: '#38bdf8',
    terminalA: 'Dwarka Sector 21',
    terminalB: 'Noida Electronic City / Vaishali',
    stations: [
      { id: 'dwarka_sec_21', name: 'Dwarka Sector 21', hindiName: 'द्वारका सेक्टर २१', lat: 28.5522, lng: 77.0583, lineId: 'blue', order: 1, isInterchange: true, interchangeLines: ['orange'], isUnderground: true, cellTowerId: 'TOWER_DMRC_DWK21', averagePressureHpa: 1011.5 },
      { id: 'dwarka_sec_8', name: 'Dwarka Sector 8', hindiName: 'द्वारका सेक्टर ८', lat: 28.5707, lng: 77.0722, lineId: 'blue', order: 2, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_DWK8', averagePressureHpa: 1008.3 },
      { id: 'dwarka_sec_14', name: 'Dwarka Sector 14', hindiName: 'द्वारका सेक्टर १४', lat: 28.6018, lng: 77.0267, lineId: 'blue', order: 3, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_DWK14', averagePressureHpa: 1008.2 },
      { id: 'dwarka_mor', name: 'Dwarka Mor', hindiName: 'द्वारका मोड़', lat: 28.6192, lng: 77.0326, lineId: 'blue', order: 4, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_DWMOR', averagePressureHpa: 1008.2 },
      { id: 'uttam_nagar_east', name: 'Uttam Nagar East', hindiName: 'उत्तम नगर पूर्व', lat: 28.6253, lng: 77.0644, lineId: 'blue', order: 5, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_UTME', averagePressureHpa: 1008.1 },
      { id: 'janakpuri_west', name: 'Janakpuri West', hindiName: 'जनकपुरी पश्चिम', lat: 28.6294, lng: 77.0777, lineId: 'blue', order: 6, isInterchange: true, interchangeLines: ['magenta'], isUnderground: false, cellTowerId: 'TOWER_DMRC_JKPW', averagePressureHpa: 1008.1 },
      { id: 'tilak_nagar', name: 'Tilak Nagar', hindiName: 'तिलक नगर', lat: 28.6366, lng: 77.0963, lineId: 'blue', order: 7, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_TLKN', averagePressureHpa: 1008.0 },
      { id: 'subhash_nagar', name: 'Subhash Nagar', hindiName: 'सुभाष नगर', lat: 28.6401, lng: 77.1049, lineId: 'blue', order: 8, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_SBNG', averagePressureHpa: 1008.0 },
      { id: 'rajouri_garden', name: 'Rajouri Garden', hindiName: 'राजौरी गार्डन', lat: 28.6493, lng: 77.1226, lineId: 'blue', order: 9, isInterchange: true, interchangeLines: ['pink'], isUnderground: false, cellTowerId: 'TOWER_DMRC_RG', averagePressureHpa: 1008.0 },
      { id: 'ramesh_nagar', name: 'Ramesh Nagar', hindiName: 'रमेश नगर', lat: 28.6528, lng: 77.1303, lineId: 'blue', order: 10, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_RMSH', averagePressureHpa: 1008.0 },
      { id: 'moti_nagar', name: 'Moti Nagar', hindiName: 'मोती नगर', lat: 28.6578, lng: 77.1422, lineId: 'blue', order: 11, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_MOTI', averagePressureHpa: 1008.0 },
      { id: 'kirti_nagar', name: 'Kirti Nagar', hindiName: 'कीर्ति नगर', lat: 28.6558, lng: 77.1497, lineId: 'blue', order: 12, isInterchange: true, interchangeLines: ['green'], isUnderground: false, cellTowerId: 'TOWER_DMRC_KN', averagePressureHpa: 1008.0 },
      { id: 'shadipur', name: 'Shadipur', hindiName: 'शादीपुर', lat: 28.6517, lng: 77.1583, lineId: 'blue', order: 13, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_SHDP', averagePressureHpa: 1008.1 },
      { id: 'patel_nagar', name: 'Patel Nagar', hindiName: 'पटेल नगर', lat: 28.6472, lng: 77.1689, lineId: 'blue', order: 14, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_PTLN', averagePressureHpa: 1008.2 },
      { id: 'rajendra_place', name: 'Rajendra Place', hindiName: 'राजेंद्र प्लेस', lat: 28.6425, lng: 77.1783, lineId: 'blue', order: 15, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_RJPL', averagePressureHpa: 1008.2 },
      { id: 'karol_bagh', name: 'Karol Bagh', hindiName: 'करोल बाग', lat: 28.6443, lng: 77.1901, lineId: 'blue', order: 16, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_KB', averagePressureHpa: 1008.3 },
      { id: 'jhandewalan', name: 'Jhandewalan', hindiName: 'झंडेवालान', lat: 28.6442, lng: 77.1997, lineId: 'blue', order: 17, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_JHDW', averagePressureHpa: 1008.3 },
      { id: 'rk_ashram_marg', name: 'RK Ashram Marg', hindiName: 'आरके आश्रम मार्ग', lat: 28.6392, lng: 77.2092, lineId: 'blue', order: 18, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_RKAS', averagePressureHpa: 1008.3 },
      { id: 'rajiv_chowk', name: 'Rajiv Chowk (Connaught Place)', hindiName: 'राजीव चौक', lat: 28.6328, lng: 77.2197, lineId: 'blue', order: 19, isInterchange: true, interchangeLines: ['yellow'], isUnderground: true, cellTowerId: 'TOWER_DMRC_RC_CP', averagePressureHpa: 1012.8 },
      { id: 'barakhamba_road', name: 'Barakhamba Road', hindiName: 'बाराखंभा रोड', lat: 28.6300, lng: 77.2272, lineId: 'blue', order: 20, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_BKRD', averagePressureHpa: 1012.5 },
      { id: 'mandi_house', name: 'Mandi House', hindiName: 'मंडी हाउस', lat: 28.6258, lng: 77.2343, lineId: 'blue', order: 21, isInterchange: true, interchangeLines: ['violet'], isUnderground: true, cellTowerId: 'TOWER_DMRC_MDH', averagePressureHpa: 1012.4 },
      { id: 'supreme_court', name: 'Supreme Court', hindiName: 'सुप्रीम कोर्ट', lat: 28.6186, lng: 77.2435, lineId: 'blue', order: 22, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_SCPM', averagePressureHpa: 1008.1 },
      { id: 'indraprastha', name: 'Indraprastha', hindiName: 'इंद्रप्रस्थ', lat: 28.6197, lng: 77.2522, lineId: 'blue', order: 23, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_INDP', averagePressureHpa: 1008.0 },
      { id: 'yamuna_bank', name: 'Yamuna Bank', hindiName: 'यमुना बैंक', lat: 28.6231, lng: 77.2662, lineId: 'blue', order: 24, isInterchange: true, interchangeLines: ['blue_branch'], isUnderground: false, cellTowerId: 'TOWER_DMRC_YB', averagePressureHpa: 1007.8 },
      { id: 'akshardham', name: 'Akshardham', hindiName: 'अक्षरधाम', lat: 28.6181, lng: 77.2789, lineId: 'blue', order: 25, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_AKSH', averagePressureHpa: 1007.9 },
      { id: 'mayur_vihar_1', name: 'Mayur Vihar 1', hindiName: 'मयूर विहार १', lat: 28.6047, lng: 77.2947, lineId: 'blue', order: 26, isInterchange: true, interchangeLines: ['pink'], isUnderground: false, cellTowerId: 'TOWER_DMRC_MV1', averagePressureHpa: 1007.9 },
      { id: 'mayur_vihar_ext', name: 'Mayur Vihar Extension', hindiName: 'मयूर विहार एक्सटेंशन', lat: 28.5939, lng: 77.3061, lineId: 'blue', order: 27, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_MVEX', averagePressureHpa: 1008.0 },
      { id: 'new_ashok_nagar', name: 'New Ashok Nagar', hindiName: 'न्यू अशोक नगर', lat: 28.5889, lng: 77.3117, lineId: 'blue', order: 28, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_NASH', averagePressureHpa: 1008.0 },
      { id: 'noida_sec_15', name: 'Noida Sector 15', hindiName: 'नोएडा सेक्टर १५', lat: 28.5847, lng: 77.3142, lineId: 'blue', order: 29, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_N15', averagePressureHpa: 1008.0 },
      { id: 'noida_sec_16', name: 'Noida Sector 16', hindiName: 'नोएडा सेक्टर १६', lat: 28.5786, lng: 77.3178, lineId: 'blue', order: 30, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_N16', averagePressureHpa: 1008.0 },
      { id: 'noida_sec_18', name: 'Noida Sector 18 (Atta Market)', hindiName: 'नोएडा सेक्टर १८', lat: 28.5708, lng: 77.3261, lineId: 'blue', order: 31, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_N18', averagePressureHpa: 1008.0 },
      { id: 'botanical_garden', name: 'Botanical Garden', hindiName: 'बॉटनिकल गार्डन', lat: 28.5642, lng: 77.3341, lineId: 'blue', order: 32, isInterchange: true, interchangeLines: ['magenta'], isUnderground: false, cellTowerId: 'TOWER_DMRC_BG', averagePressureHpa: 1008.1 },
      { id: 'golf_course', name: 'Golf Course', hindiName: 'गोल्फ कोर्स', lat: 28.5672, lng: 77.3458, lineId: 'blue', order: 33, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_GLFC', averagePressureHpa: 1008.1 },
      { id: 'noida_city_centre', name: 'Noida City Centre', hindiName: 'नोएडा सिटी सेंटर', lat: 28.5744, lng: 77.3561, lineId: 'blue', order: 34, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_NCC', averagePressureHpa: 1008.1 },
      { id: 'noida_sec_34', name: 'Noida Sector 34', hindiName: 'नोएडा सेक्टर ३४', lat: 28.5833, lng: 77.3622, lineId: 'blue', order: 35, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_N34', averagePressureHpa: 1008.1 },
      { id: 'noida_sec_52', name: 'Noida Sector 52', hindiName: 'नोएडा सेक्टर ५२', lat: 28.5917, lng: 77.3683, lineId: 'blue', order: 36, isInterchange: true, interchangeLines: ['aqua'], isUnderground: false, cellTowerId: 'TOWER_DMRC_N52', averagePressureHpa: 1008.1 },
      { id: 'noida_sec_61', name: 'Noida Sector 61', hindiName: 'नोएडा सेक्टर ६१', lat: 28.6042, lng: 77.3667, lineId: 'blue', order: 37, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_N61', averagePressureHpa: 1008.2 },
      { id: 'noida_sec_59', name: 'Noida Sector 59', hindiName: 'नोएडा सेक्टर ५९', lat: 28.6158, lng: 77.3689, lineId: 'blue', order: 38, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_N59', averagePressureHpa: 1008.2 },
      { id: 'noida_sec_62', name: 'Noida Sector 62', hindiName: 'नोएडा सेक्टर ६२', lat: 28.6231, lng: 77.3719, lineId: 'blue', order: 39, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_N62', averagePressureHpa: 1008.2 },
      { id: 'noida_electronic_city', name: 'Noida Electronic City', hindiName: 'नोएडा इलेक्ट्रॉनिक सिटी', lat: 28.6277, lng: 77.3739, lineId: 'blue', order: 40, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_NEC', averagePressureHpa: 1008.2 },
      // Vaishali Branch
      { id: 'laxmi_nagar', name: 'Laxmi Nagar', hindiName: 'लक्ष्मी नगर', lat: 28.6308, lng: 77.2775, lineId: 'blue', order: 41, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_LXMN', averagePressureHpa: 1007.9 },
      { id: 'nirman_vihar', name: 'Nirman Vihar', hindiName: 'निर्माण विहार', lat: 28.6369, lng: 77.2869, lineId: 'blue', order: 42, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_NRMN', averagePressureHpa: 1008.0 },
      { id: 'preet_vihar', name: 'Preet Vihar', hindiName: 'प्रीत विहार', lat: 28.6406, lng: 77.2961, lineId: 'blue', order: 43, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_PRET', averagePressureHpa: 1008.0 },
      { id: 'karkarduma', name: 'Karkarduma', hindiName: 'कड़कड़डूमा', lat: 28.6486, lng: 77.3056, lineId: 'blue', order: 44, isInterchange: true, interchangeLines: ['pink'], isUnderground: false, cellTowerId: 'TOWER_DMRC_KKDM', averagePressureHpa: 1008.0 },
      { id: 'anand_vihar_isbt', name: 'Anand Vihar ISBT', hindiName: 'आनंद विहार', lat: 28.6472, lng: 77.3158, lineId: 'blue', order: 45, isInterchange: true, interchangeLines: ['pink'], isUnderground: false, cellTowerId: 'TOWER_DMRC_AVIS', averagePressureHpa: 1008.1 },
      { id: 'kaushambi', name: 'Kaushambi', hindiName: 'कौशाम्बी', lat: 28.6453, lng: 77.3242, lineId: 'blue', order: 46, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_KSHM', averagePressureHpa: 1008.1 },
      { id: 'vaishali', name: 'Vaishali', hindiName: 'वैशाली', lat: 28.6497, lng: 77.3397, lineId: 'blue', order: 47, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_VSHL', averagePressureHpa: 1008.1 }
    ]
  },
  {
    id: 'yellow',
    name: 'Yellow Line',
    color: '#eab308',
    accentColor: '#fde047',
    terminalA: 'Samaypur Badli',
    terminalB: 'Millennium City Centre Gurugram',
    stations: [
      { id: 'samaypur_badli', name: 'Samaypur Badli', hindiName: 'समयपुर बादली', lat: 28.7456, lng: 77.1350, lineId: 'yellow', order: 1, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_SMBD', averagePressureHpa: 1008.1 },
      { id: 'haiderpur_badli_mor', name: 'Haiderpur Badli Mor', hindiName: 'हैदरपुर बादली मोड़', lat: 28.7297, lng: 77.1539, lineId: 'yellow', order: 2, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_HPBM', averagePressureHpa: 1008.2 },
      { id: 'jahangirpuri', name: 'Jahangirpuri', hindiName: 'जहाँगीरपुरी', lat: 28.7258, lng: 77.1644, lineId: 'yellow', order: 3, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_JHGP', averagePressureHpa: 1008.2 },
      { id: 'azadpur', name: 'Azadpur', hindiName: 'आज़ादपुर', lat: 28.7072, lng: 77.1794, lineId: 'yellow', order: 4, isInterchange: true, interchangeLines: ['pink'], isUnderground: false, cellTowerId: 'TOWER_DMRC_AZDP', averagePressureHpa: 1008.2 },
      { id: 'gtb_nagar', name: 'Guru Tegh Bahadur Nagar', hindiName: 'जीटीबी नगर', lat: 28.6978, lng: 77.2069, lineId: 'yellow', order: 5, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_GTBN', averagePressureHpa: 1012.6 },
      { id: 'vishwavidyalaya', name: 'Vishwavidyalaya (DU North Campus)', hindiName: 'विश्वविद्यालय', lat: 28.6946, lng: 77.2144, lineId: 'yellow', order: 6, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_DU_NC', averagePressureHpa: 1012.6 },
      { id: 'civil_lines', name: 'Civil Lines', hindiName: 'सिविल लाइन्स', lat: 28.6778, lng: 77.2247, lineId: 'yellow', order: 7, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_CVLN', averagePressureHpa: 1012.8 },
      { id: 'kashmere_gate', name: 'Kashmere Gate', hindiName: 'कश्मीरी गेट', lat: 28.6675, lng: 77.2285, lineId: 'yellow', order: 8, isInterchange: true, interchangeLines: ['red', 'violet'], isUnderground: true, cellTowerId: 'TOWER_DMRC_KG', averagePressureHpa: 1013.2 },
      { id: 'chandni_chowk', name: 'Chandni Chowk', hindiName: 'चाँदनी चौक', lat: 28.6578, lng: 77.2303, lineId: 'yellow', order: 9, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_CC', averagePressureHpa: 1012.9 },
      { id: 'chawri_bazar', name: 'Chawri Bazar', hindiName: 'चावड़ी बाज़ार', lat: 28.6494, lng: 77.2269, lineId: 'yellow', order: 10, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_CWBZ', averagePressureHpa: 1013.6 },
      { id: 'new_delhi', name: 'New Delhi Railway Station', hindiName: 'नई दिल्ली', lat: 28.6431, lng: 77.2223, lineId: 'yellow', order: 11, isInterchange: true, interchangeLines: ['orange'], isUnderground: true, cellTowerId: 'TOWER_DMRC_NDLS', averagePressureHpa: 1012.7 },
      { id: 'rajiv_chowk_y', name: 'Rajiv Chowk (Connaught Place)', hindiName: 'राजीव चौक', lat: 28.6328, lng: 77.2197, lineId: 'yellow', order: 12, isInterchange: true, interchangeLines: ['blue'], isUnderground: true, cellTowerId: 'TOWER_DMRC_RC_CP', averagePressureHpa: 1012.8 },
      { id: 'patel_chowk', name: 'Patel Chowk', hindiName: 'पटेल चौक', lat: 28.6231, lng: 77.2136, lineId: 'yellow', order: 13, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_PTCK', averagePressureHpa: 1012.6 },
      { id: 'central_secretariat', name: 'Central Secretariat', hindiName: 'केंद्रीय सचिवालय', lat: 28.6147, lng: 77.2119, lineId: 'yellow', order: 14, isInterchange: true, interchangeLines: ['violet'], isUnderground: true, cellTowerId: 'TOWER_DMRC_CS', averagePressureHpa: 1012.6 },
      { id: 'udyog_bhawan', name: 'Udyog Bhawan', hindiName: 'उद्योग भवन', lat: 28.6114, lng: 77.2122, lineId: 'yellow', order: 15, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_UDBH', averagePressureHpa: 1012.6 },
      { id: 'jor_bagh', name: 'Jor Bagh', hindiName: 'जोर बाग', lat: 28.5886, lng: 77.2119, lineId: 'yellow', order: 16, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_JRBGH', averagePressureHpa: 1012.5 },
      { id: 'dilli_haat_ina', name: 'Dilli Haat INA', hindiName: 'दिल्ली हाट आईएनए', lat: 28.5744, lng: 77.2097, lineId: 'yellow', order: 17, isInterchange: true, interchangeLines: ['pink'], isUnderground: true, cellTowerId: 'TOWER_DMRC_INA', averagePressureHpa: 1012.7 },
      { id: 'aiims', name: 'AIIMS', hindiName: 'एम्स', lat: 28.5678, lng: 77.2081, lineId: 'yellow', order: 18, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_AIIMS', averagePressureHpa: 1012.8 },
      { id: 'green_park', name: 'Green Park', hindiName: 'ग्रीन पार्क', lat: 28.5589, lng: 77.2069, lineId: 'yellow', order: 19, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_GRPK', averagePressureHpa: 1012.8 },
      { id: 'hauz_khas', name: 'Hauz Khas (IIT Delhi)', hindiName: 'हौज़ खास', lat: 28.5434, lng: 77.2064, lineId: 'yellow', order: 20, isInterchange: true, interchangeLines: ['magenta'], isUnderground: true, cellTowerId: 'TOWER_DMRC_HK', averagePressureHpa: 1013.5 },
      { id: 'malviya_nagar', name: 'Malviya Nagar', hindiName: 'मालवीय नगर', lat: 28.5283, lng: 77.2056, lineId: 'yellow', order: 21, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_MLVN', averagePressureHpa: 1012.5 },
      { id: 'saket', name: 'Saket', hindiName: 'साकेत', lat: 28.5204, lng: 77.2016, lineId: 'yellow', order: 22, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_SKT', averagePressureHpa: 1012.4 },
      { id: 'qutab_minar', name: 'Qutab Minar', hindiName: 'क़ुतुब मीनार', lat: 28.5133, lng: 77.1856, lineId: 'yellow', order: 23, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_QTBM', averagePressureHpa: 1008.2 },
      { id: 'chhatarpur', name: 'Chhatarpur', hindiName: 'छतरपुर', lat: 28.5064, lng: 77.1747, lineId: 'yellow', order: 24, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_CHTR', averagePressureHpa: 1008.2 },
      { id: 'sultanpur', name: 'Sultanpur', hindiName: 'सुल्तानपुर', lat: 28.4989, lng: 77.1614, lineId: 'yellow', order: 25, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_SLTN', averagePressureHpa: 1008.2 },
      { id: 'arjan_garh', name: 'Arjan Garh', hindiName: 'अर्जन गढ़', lat: 28.4808, lng: 77.1256, lineId: 'yellow', order: 26, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_ARJN', averagePressureHpa: 1008.2 },
      { id: 'guru_dronacharya', name: 'Guru Dronacharya', hindiName: 'गुरु द्रोणाचार्य', lat: 28.4819, lng: 77.1039, lineId: 'yellow', order: 27, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_GRDR', averagePressureHpa: 1008.2 },
      { id: 'cyber_city_sikanderpur', name: 'Sikanderpur (DLF CyberCity)', hindiName: 'सिकंदरपुर', lat: 28.4819, lng: 77.0927, lineId: 'yellow', order: 28, isInterchange: true, interchangeLines: ['rapid_metro'], isUnderground: false, cellTowerId: 'TOWER_DMRC_SKP', averagePressureHpa: 1008.2 },
      { id: 'mg_road', name: 'MG Road', hindiName: 'एमजी रोड', lat: 28.4797, lng: 77.0803, lineId: 'yellow', order: 29, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_MGRD', averagePressureHpa: 1008.1 },
      { id: 'iffco_chowk', name: 'IFFCO Chowk', hindiName: 'इफको चौक', lat: 28.4722, lng: 77.0725, lineId: 'yellow', order: 30, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_IFCK', averagePressureHpa: 1008.1 },
      { id: 'millennium_city_centre', name: 'Millennium City Centre Gurugram', hindiName: 'मिलेनियम सिटी सेंटर', lat: 28.4593, lng: 77.0725, lineId: 'yellow', order: 31, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_MCCG', averagePressureHpa: 1008.1 }
    ]
  },
  {
    id: 'red',
    name: 'Red Line',
    color: '#dc2626',
    accentColor: '#f87171',
    terminalA: 'Rithala',
    terminalB: 'Shaheed Sthal (New Bus Adda)',
    stations: [
      { id: 'rithala', name: 'Rithala', hindiName: 'रिठाला', lat: 28.7208, lng: 77.1072, lineId: 'red', order: 1, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_RTHL', averagePressureHpa: 1008.1 },
      { id: 'rohini_west', name: 'Rohini West', hindiName: 'रोहिणी पश्चिम', lat: 28.7147, lng: 77.1147, lineId: 'red', order: 2, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_RHW', averagePressureHpa: 1008.1 },
      { id: 'pitampura', name: 'Pitampura', hindiName: 'पीतमपुरा', lat: 28.7031, lng: 77.1342, lineId: 'red', order: 3, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_PTMP', averagePressureHpa: 1008.2 },
      { id: 'netaji_subhash_place', name: 'Netaji Subhash Place', hindiName: 'नेताजी सुभाष प्लेस', lat: 28.6953, lng: 77.1517, lineId: 'red', order: 4, isInterchange: true, interchangeLines: ['pink'], isUnderground: false, cellTowerId: 'TOWER_DMRC_NSP', averagePressureHpa: 1008.2 },
      { id: 'inderlok', name: 'Inderlok', hindiName: 'इंद्रलोक', lat: 28.6731, lng: 77.1697, lineId: 'red', order: 5, isInterchange: true, interchangeLines: ['green'], isUnderground: false, cellTowerId: 'TOWER_DMRC_INDL', averagePressureHpa: 1008.3 },
      { id: 'shastri_nagar', name: 'Shastri Nagar', hindiName: 'शास्त्री नगर', lat: 28.6689, lng: 77.1822, lineId: 'red', order: 6, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_SHST', averagePressureHpa: 1008.3 },
      { id: 'tis_hazari', name: 'Tis Hazari', hindiName: 'तीस हज़ारी', lat: 28.6672, lng: 77.2189, lineId: 'red', order: 7, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_TSHZ', averagePressureHpa: 1008.3 },
      { id: 'kashmere_gate_r', name: 'Kashmere Gate', hindiName: 'कश्मीरी गेट', lat: 28.6675, lng: 77.2285, lineId: 'red', order: 8, isInterchange: true, interchangeLines: ['yellow', 'violet'], isUnderground: false, cellTowerId: 'TOWER_DMRC_KG', averagePressureHpa: 1008.4 },
      { id: 'shastri_park', name: 'Shastri Park', hindiName: 'शास्त्री पार्क', lat: 28.6689, lng: 77.2503, lineId: 'red', order: 9, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_SHPK', averagePressureHpa: 1008.0 },
      { id: 'welcome', name: 'Welcome', hindiName: 'वेलकम', lat: 28.6719, lng: 77.2778, lineId: 'red', order: 10, isInterchange: true, interchangeLines: ['pink'], isUnderground: false, cellTowerId: 'TOWER_DMRC_WLCM', averagePressureHpa: 1008.0 },
      { id: 'shahdara', name: 'Shahdara', hindiName: 'शाहदरा', lat: 28.6733, lng: 77.2897, lineId: 'red', order: 11, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_SHDR', averagePressureHpa: 1008.0 },
      { id: 'dilshad_garden', name: 'Dilshad Garden', hindiName: 'दिलशाद गार्डन', lat: 28.6758, lng: 77.3217, lineId: 'red', order: 12, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_DLGD', averagePressureHpa: 1008.1 },
      { id: 'mohan_nagar', name: 'Mohan Nagar', hindiName: 'मोहन नगर', lat: 28.6792, lng: 77.3611, lineId: 'red', order: 13, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_MHNG', averagePressureHpa: 1008.1 },
      { id: 'shaheed_sthal', name: 'Shaheed Sthal (New Bus Adda)', hindiName: 'शहीद स्थल', lat: 28.6711, lng: 77.4189, lineId: 'red', order: 14, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_SHSTH', averagePressureHpa: 1008.2 }
    ]
  },
  {
    id: 'pink',
    name: 'Pink Line',
    color: '#db2777',
    accentColor: '#f472b6',
    terminalA: 'Majlis Park',
    terminalB: 'Shiv Vihar',
    stations: [
      { id: 'majlis_park', name: 'Majlis Park', hindiName: 'मजलिस पार्क', lat: 28.7214, lng: 77.1789, lineId: 'pink', order: 1, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_MJLP', averagePressureHpa: 1008.2 },
      { id: 'azadpur_p', name: 'Azadpur', hindiName: 'आज़ादपुर', lat: 28.7072, lng: 77.1794, lineId: 'pink', order: 2, isInterchange: true, interchangeLines: ['yellow'], isUnderground: true, cellTowerId: 'TOWER_DMRC_AZDP', averagePressureHpa: 1012.7 },
      { id: 'netaji_subhash_place_p', name: 'Netaji Subhash Place', hindiName: 'नेताजी सुभाष प्लेस', lat: 28.6953, lng: 77.1517, lineId: 'pink', order: 3, isInterchange: true, interchangeLines: ['red'], isUnderground: true, cellTowerId: 'TOWER_DMRC_NSP', averagePressureHpa: 1012.6 },
      { id: 'punjabi_bagh_west', name: 'Punjabi Bagh West', hindiName: 'पंजाबी बाग पश्चिम', lat: 28.6711, lng: 77.1311, lineId: 'pink', order: 4, isInterchange: true, interchangeLines: ['green'], isUnderground: false, cellTowerId: 'TOWER_DMRC_PBGW', averagePressureHpa: 1008.0 },
      { id: 'rajouri_garden_p', name: 'Rajouri Garden', hindiName: 'राजौरी गार्डन', lat: 28.6493, lng: 77.1226, lineId: 'pink', order: 5, isInterchange: true, interchangeLines: ['blue'], isUnderground: false, cellTowerId: 'TOWER_DMRC_RG', averagePressureHpa: 1008.0 },
      { id: 'delhi_cantt', name: 'Delhi Cantt', hindiName: 'दिल्ली कैंट', lat: 28.6014, lng: 77.1497, lineId: 'pink', order: 6, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_DLCT', averagePressureHpa: 1008.1 },
      { id: 'south_campus', name: 'Durgabai Deshmukh South Campus', hindiName: 'साउथ कैंपस', lat: 28.5881, lng: 77.1636, lineId: 'pink', order: 7, isInterchange: true, interchangeLines: ['orange'], isUnderground: false, cellTowerId: 'TOWER_DMRC_STHC', averagePressureHpa: 1008.2 },
      { id: 'sarojini_nagar', name: 'Sarojini Nagar', hindiName: 'सरोजिनी नगर', lat: 28.5722, lng: 77.1997, lineId: 'pink', order: 8, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_SRJN', averagePressureHpa: 1012.6 },
      { id: 'dilli_haat_ina_p', name: 'Dilli Haat INA', hindiName: 'दिल्ली हाट आईएनए', lat: 28.5744, lng: 77.2097, lineId: 'pink', order: 9, isInterchange: true, interchangeLines: ['yellow'], isUnderground: true, cellTowerId: 'TOWER_DMRC_INA', averagePressureHpa: 1012.7 },
      { id: 'lajpat_nagar_p', name: 'Lajpat Nagar', hindiName: 'लाजपत नगर', lat: 28.5700, lng: 77.2372, lineId: 'pink', order: 10, isInterchange: true, interchangeLines: ['violet'], isUnderground: true, cellTowerId: 'TOWER_DMRC_LJPT', averagePressureHpa: 1012.8 },
      { id: 'sarai_kale_khan', name: 'Sarai Kale Khan - Nizamuddin', hindiName: 'सराय काले खां', lat: 28.5889, lng: 77.2547, lineId: 'pink', order: 11, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_SKKH', averagePressureHpa: 1007.9 },
      { id: 'mayur_vihar_1_p', name: 'Mayur Vihar 1', hindiName: 'मयूर विहार १', lat: 28.6047, lng: 77.2947, lineId: 'pink', order: 12, isInterchange: true, interchangeLines: ['blue'], isUnderground: false, cellTowerId: 'TOWER_DMRC_MV1', averagePressureHpa: 1007.9 },
      { id: 'anand_vihar_p', name: 'Anand Vihar ISBT', hindiName: 'आनंद विहार', lat: 28.6472, lng: 77.3158, lineId: 'pink', order: 13, isInterchange: true, interchangeLines: ['blue'], isUnderground: false, cellTowerId: 'TOWER_DMRC_AVIS', averagePressureHpa: 1008.1 },
      { id: 'welcome_p', name: 'Welcome', hindiName: 'वेलकम', lat: 28.6719, lng: 77.2778, lineId: 'pink', order: 14, isInterchange: true, interchangeLines: ['red'], isUnderground: false, cellTowerId: 'TOWER_DMRC_WLCM', averagePressureHpa: 1008.0 },
      { id: 'shiv_vihar', name: 'Shiv Vihar', hindiName: 'शिव विहार', lat: 28.7189, lng: 77.2947, lineId: 'pink', order: 15, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_SHVV', averagePressureHpa: 1008.1 }
    ]
  },
  {
    id: 'magenta',
    name: 'Magenta Line',
    color: '#9333ea',
    accentColor: '#c084fc',
    terminalA: 'Janakpuri West',
    terminalB: 'Botanical Garden',
    stations: [
      { id: 'janakpuri_west_m', name: 'Janakpuri West', hindiName: 'जनकपुरी पश्चिम', lat: 28.6294, lng: 77.0777, lineId: 'magenta', order: 1, isInterchange: true, interchangeLines: ['blue'], isUnderground: true, cellTowerId: 'TOWER_DMRC_JKPW', averagePressureHpa: 1012.7 },
      { id: 'palam', name: 'Palam', hindiName: 'पालम', lat: 28.5911, lng: 77.0947, lineId: 'magenta', order: 2, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_PLM', averagePressureHpa: 1012.6 },
      { id: 'terminal_1_igi', name: 'Terminal 1 IGI Airport', hindiName: 'टर्मिनल १ आईजीआई एयरपोर्ट', lat: 28.5636, lng: 77.1219, lineId: 'magenta', order: 3, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_T1AP', averagePressureHpa: 1013.1 },
      { id: 'munirka', name: 'Munirka', hindiName: 'मुनीरका', lat: 28.5583, lng: 77.1739, lineId: 'magenta', order: 4, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_MNRK', averagePressureHpa: 1012.7 },
      { id: 'iit_delhi', name: 'IIT Delhi', hindiName: 'आईआईटी दिल्ली', lat: 28.5458, lng: 77.1956, lineId: 'magenta', order: 5, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_IITD', averagePressureHpa: 1013.2 },
      { id: 'hauz_khas_m', name: 'Hauz Khas (IIT Delhi)', hindiName: 'हौज़ खास', lat: 28.5434, lng: 77.2064, lineId: 'magenta', order: 6, isInterchange: true, interchangeLines: ['yellow'], isUnderground: true, cellTowerId: 'TOWER_DMRC_HK', averagePressureHpa: 1013.5 },
      { id: 'greater_kailash', name: 'Greater Kailash', hindiName: 'ग्रेटर कैलाश', lat: 28.5403, lng: 77.2417, lineId: 'magenta', order: 7, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_GRTK', averagePressureHpa: 1012.8 },
      { id: 'kalkaji_mandir_m', name: 'Kalkaji Mandir', hindiName: 'कालकाजी मंदिर', lat: 28.5500, lng: 77.2600, lineId: 'magenta', order: 8, isInterchange: true, interchangeLines: ['violet'], isUnderground: true, cellTowerId: 'TOWER_DMRC_KLKM', averagePressureHpa: 1012.9 },
      { id: 'jamia_millia', name: 'Jamia Millia Islamia', hindiName: 'जामिया मिलिया इस्लामिया', lat: 28.5631, lng: 77.2858, lineId: 'magenta', order: 9, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_JMIS', averagePressureHpa: 1007.9 },
      { id: 'kalindi_kunj', name: 'Kalindi Kunj', hindiName: 'कालिंदी कुंज', lat: 28.5469, lng: 77.3197, lineId: 'magenta', order: 10, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_KLND', averagePressureHpa: 1008.0 },
      { id: 'botanical_garden_m', name: 'Botanical Garden', hindiName: 'बॉटनिकल गार्डन', lat: 28.5642, lng: 77.3341, lineId: 'magenta', order: 11, isInterchange: true, interchangeLines: ['blue'], isUnderground: false, cellTowerId: 'TOWER_DMRC_BG', averagePressureHpa: 1008.1 }
    ]
  },
  {
    id: 'violet',
    name: 'Violet Line',
    color: '#7c3aed',
    accentColor: '#a855f7',
    terminalA: 'Kashmere Gate',
    terminalB: 'Raja Nahar Singh (Ballabhgarh)',
    stations: [
      { id: 'kashmere_gate_v', name: 'Kashmere Gate', hindiName: 'कश्मीरी गेट', lat: 28.6675, lng: 77.2285, lineId: 'violet', order: 1, isInterchange: true, interchangeLines: ['red', 'yellow'], isUnderground: true, cellTowerId: 'TOWER_DMRC_KG', averagePressureHpa: 1013.2 },
      { id: 'lal_quila', name: 'Lal Quila (Red Fort)', hindiName: 'लाल किला', lat: 28.6561, lng: 77.2372, lineId: 'violet', order: 2, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_LLQL', averagePressureHpa: 1012.9 },
      { id: 'ito', name: 'ITO', hindiName: 'आईटीओ', lat: 28.6294, lng: 77.2411, lineId: 'violet', order: 3, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_ITON', averagePressureHpa: 1012.5 },
      { id: 'mandi_house_v', name: 'Mandi House', hindiName: 'मंडी हाउस', lat: 28.6258, lng: 77.2343, lineId: 'violet', order: 4, isInterchange: true, interchangeLines: ['blue'], isUnderground: true, cellTowerId: 'TOWER_DMRC_MDH', averagePressureHpa: 1012.4 },
      { id: 'central_secretariat_v', name: 'Central Secretariat', hindiName: 'केंद्रीय सचिवालय', lat: 28.6147, lng: 77.2119, lineId: 'violet', order: 5, isInterchange: true, interchangeLines: ['yellow'], isUnderground: true, cellTowerId: 'TOWER_DMRC_CS', averagePressureHpa: 1012.6 },
      { id: 'lajpat_nagar_v', name: 'Lajpat Nagar', hindiName: 'लाजपत नगर', lat: 28.5700, lng: 77.2372, lineId: 'violet', order: 6, isInterchange: true, interchangeLines: ['pink'], isUnderground: true, cellTowerId: 'TOWER_DMRC_LJPT', averagePressureHpa: 1012.8 },
      { id: 'nehru_place', name: 'Nehru Place', hindiName: 'नेहरू प्लेस', lat: 28.5489, lng: 77.2519, lineId: 'violet', order: 7, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_NHPL', averagePressureHpa: 1008.1 },
      { id: 'kalkaji_mandir_v', name: 'Kalkaji Mandir', hindiName: 'कालकाजी मंदिर', lat: 28.5500, lng: 77.2600, lineId: 'violet', order: 8, isInterchange: true, interchangeLines: ['magenta'], isUnderground: false, cellTowerId: 'TOWER_DMRC_KLKM', averagePressureHpa: 1008.1 },
      { id: 'badarpur_border', name: 'Badarpur Border', hindiName: 'बदरपुर बॉर्डर', lat: 28.4878, lng: 77.3069, lineId: 'violet', order: 9, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_BDRP', averagePressureHpa: 1008.2 },
      { id: 'raja_nahar_singh', name: 'Raja Nahar Singh (Ballabhgarh)', hindiName: 'राजा नाहर सिंह', lat: 28.3389, lng: 77.3208, lineId: 'violet', order: 10, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_RJNH', averagePressureHpa: 1008.2 }
    ]
  },
  {
    id: 'orange',
    name: 'Airport Express (Orange)',
    color: '#ea580c',
    accentColor: '#fb923c',
    terminalA: 'New Delhi Railway Station',
    terminalB: 'Yashobhoomi Dwarka Sector 25',
    stations: [
      { id: 'new_delhi_o', name: 'New Delhi Railway Station', hindiName: 'नई दिल्ली', lat: 28.6431, lng: 77.2223, lineId: 'orange', order: 1, isInterchange: true, interchangeLines: ['yellow'], isUnderground: true, cellTowerId: 'TOWER_DMRC_NDLS', averagePressureHpa: 1012.7 },
      { id: 'shivaji_stadium', name: 'Shivaji Stadium', hindiName: 'शिवाजी स्टेडियम', lat: 28.6289, lng: 77.2133, lineId: 'orange', order: 2, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_SHVJ', averagePressureHpa: 1012.6 },
      { id: 'dhaula_kuan', name: 'Dhaula Kuan', hindiName: 'धौला कुआँ', lat: 28.5881, lng: 77.1636, lineId: 'orange', order: 3, isInterchange: true, interchangeLines: ['pink'], isUnderground: false, cellTowerId: 'TOWER_DMRC_DHLK', averagePressureHpa: 1008.2 },
      { id: 'delhi_aerocity', name: 'Delhi Aerocity', hindiName: 'दिल्ली एरोसिटी', lat: 28.5508, lng: 77.1219, lineId: 'orange', order: 4, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_AERO', averagePressureHpa: 1012.9 },
      { id: 'igi_airport_t3', name: 'IGI Airport Terminal 3', hindiName: 'आईजीआई एयरपोर्ट टी३', lat: 28.5564, lng: 77.0864, lineId: 'orange', order: 5, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_T3AP', averagePressureHpa: 1013.0 },
      { id: 'dwarka_sec_21_o', name: 'Dwarka Sector 21', hindiName: 'द्वारका सेक्टर २१', lat: 28.5522, lng: 77.0583, lineId: 'orange', order: 6, isInterchange: true, interchangeLines: ['blue'], isUnderground: true, cellTowerId: 'TOWER_DMRC_DWK21', averagePressureHpa: 1011.5 },
      { id: 'yashobhoomi_dwarka_25', name: 'Yashobhoomi Dwarka Sector 25', hindiName: 'यशोभूमि द्वारका सेक्टर २५', lat: 28.5511, lng: 77.0397, lineId: 'orange', order: 7, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_YSHB', averagePressureHpa: 1012.0 }
    ]
  },
  {
    id: 'green',
    name: 'Green Line',
    color: '#16a34a',
    accentColor: '#4ade80',
    terminalA: 'Brigadier Hoshiar Singh',
    terminalB: 'Inderlok / Kirti Nagar',
    stations: [
      { id: 'hoshiar_singh', name: 'Brigadier Hoshiar Singh', hindiName: 'ब्रिगेडियर होशियार सिंह', lat: 28.6917, lng: 76.9208, lineId: 'green', order: 1, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_BHSH', averagePressureHpa: 1008.0 },
      { id: 'bahadurgarh_city', name: 'Bahadurgarh City', hindiName: 'बहादुरगढ़ सिटी', lat: 28.6889, lng: 76.9389, lineId: 'green', order: 2, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_BHDG', averagePressureHpa: 1008.0 },
      { id: 'mundka', name: 'Mundka', hindiName: 'मुंडका', lat: 28.6817, lng: 77.0319, lineId: 'green', order: 3, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_MNDK', averagePressureHpa: 1008.1 },
      { id: 'peera_garhi', name: 'Peera Garhi', hindiName: 'पीरागढ़ी', lat: 28.6792, lng: 77.0931, lineId: 'green', order: 4, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_PRGR', averagePressureHpa: 1008.1 },
      { id: 'punjabi_bagh', name: 'Punjabi Bagh', hindiName: 'पंजाबी बाग', lat: 28.6711, lng: 77.1311, lineId: 'green', order: 5, isInterchange: true, interchangeLines: ['pink'], isUnderground: false, cellTowerId: 'TOWER_DMRC_PBGB', averagePressureHpa: 1008.0 },
      { id: 'inderlok_g', name: 'Inderlok', hindiName: 'इंद्रलोक', lat: 28.6731, lng: 77.1697, lineId: 'green', order: 6, isInterchange: true, interchangeLines: ['red'], isUnderground: false, cellTowerId: 'TOWER_DMRC_INDL', averagePressureHpa: 1008.3 },
      { id: 'kirti_nagar_g', name: 'Kirti Nagar', hindiName: 'कीर्ति नगर', lat: 28.6558, lng: 77.1497, lineId: 'green', order: 7, isInterchange: true, interchangeLines: ['blue'], isUnderground: false, cellTowerId: 'TOWER_DMRC_KN', averagePressureHpa: 1008.0 }
    ]
  },
  {
    id: 'grey',
    name: 'Grey Line',
    color: '#64748b',
    accentColor: '#94a3b8',
    terminalA: 'Dwarka',
    terminalB: 'Dhansa Bus Stand',
    stations: [
      { id: 'dwarka_g', name: 'Dwarka', hindiName: 'द्वारका', lat: 28.6018, lng: 77.0267, lineId: 'grey', order: 1, isInterchange: true, interchangeLines: ['blue'], isUnderground: false, cellTowerId: 'TOWER_DMRC_DWKA', averagePressureHpa: 1008.2 },
      { id: 'nangli', name: 'Nangli', hindiName: 'नांगली', lat: 28.6097, lng: 76.9989, lineId: 'grey', order: 2, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_DMRC_NNGL', averagePressureHpa: 1008.1 },
      { id: 'najafgarh', name: 'Najafgarh', hindiName: 'नजफगढ़', lat: 28.6139, lng: 76.9856, lineId: 'grey', order: 3, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_NJFG', averagePressureHpa: 1012.3 },
      { id: 'dhansa_bus_stand', name: 'Dhansa Bus Stand', hindiName: 'ढांसा बस स्टैंड', lat: 28.6083, lng: 76.9739, lineId: 'grey', order: 4, isInterchange: false, isUnderground: true, cellTowerId: 'TOWER_DMRC_DHNS', averagePressureHpa: 1012.3 }
    ]
  },
  {
    id: 'rapid_metro',
    name: 'Rapid Metro Gurgaon',
    color: '#0284c7',
    accentColor: '#38bdf8',
    terminalA: 'Sector 55-56',
    terminalB: 'Phase 3 (Cyber City)',
    stations: [
      { id: 'sec_55_56', name: 'Sector 55-56', hindiName: 'सेक्टर ५५-५६', lat: 28.4239, lng: 77.1089, lineId: 'rapid_metro', order: 1, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_RMG_55', averagePressureHpa: 1008.2 },
      { id: 'sec_54_chowk', name: 'Sector 54 Chowk', hindiName: 'सेक्टर ५४ चौक', lat: 28.4358, lng: 77.1089, lineId: 'rapid_metro', order: 2, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_RMG_54', averagePressureHpa: 1008.2 },
      { id: 'sikanderpur_r', name: 'Sikanderpur', hindiName: 'सिकंदरपुर', lat: 28.4819, lng: 77.0927, lineId: 'rapid_metro', order: 3, isInterchange: true, interchangeLines: ['yellow'], isUnderground: false, cellTowerId: 'TOWER_DMRC_SKP', averagePressureHpa: 1008.2 },
      { id: 'cyber_city', name: 'Cyber City', hindiName: 'साइबर सिटी', lat: 28.4972, lng: 77.0939, lineId: 'rapid_metro', order: 4, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_RMG_CYBC', averagePressureHpa: 1008.1 },
      { id: 'phase_3', name: 'Phase 3', hindiName: 'फेज ३', lat: 28.4908, lng: 77.1039, lineId: 'rapid_metro', order: 5, isInterchange: false, isUnderground: false, cellTowerId: 'TOWER_RMG_PH3', averagePressureHpa: 1008.1 }
    ]
  }
];

// Helper: compute track compass bearing between two coordinates in degrees [0, 360)
export function calculateTrackBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return (Math.round((θ * 180) / Math.PI) + 360) % 360;
}

// Find nearest station across the entire network
export function findNearestStationAcrossNetwork(lat: number, lng: number): { station: MetroStation; line: MetroLine; distanceM: number } | null {
  let best: { station: MetroStation; line: MetroLine; distanceM: number } | null = null;
  let minD = Infinity;

  for (const line of DELHI_METRO_LINES) {
    for (const st of line.stations) {
      const d = haversine(lat, lng, st.lat, st.lng);
      if (d < minD) {
        minD = d;
        best = { station: st, line, distanceM: d };
      }
    }
  }
  return best;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getActiveMetroLines(): MetroLine[] {
  const lineEnv = (process.env.BEACHHEAD_LINE || 'all').toLowerCase();
  if (lineEnv === 'all') return DELHI_METRO_LINES;
  const filtered = DELHI_METRO_LINES.filter(l => l.id === lineEnv);
  return filtered.length ? filtered : DELHI_METRO_LINES;
}

export function getBeachheadInfo() {
  const line = (process.env.BEACHHEAD_LINE || 'all').toLowerCase();
  return {
    line,
    activeLines: getActiveMetroLines().map(l => ({ id: l.id, name: l.name, stations: l.stations.length })),
    isBeachhead: line !== 'all'
  };
}

export const AVATAR_PALETTE = [
  { id: 'av_1', name: 'Cosmic Tiger', initials: 'CT', bg: 'linear-gradient(135deg, #f97316, #ef4444)' },
  { id: 'av_2', name: 'Quiet Storm', initials: 'QS', bg: 'linear-gradient(135deg, #6366f1, #8b5cf6)' },
  { id: 'av_3', name: 'Delhite Pro', initials: 'D2', bg: 'linear-gradient(135deg, #0284c7, #38bdf8)' },
  { id: 'av_4', name: 'Metro Sage', initials: 'MS', bg: 'linear-gradient(135deg, #10b981, #059669)' },
  { id: 'av_5', name: 'Cyber Chai', initials: 'CC', bg: 'linear-gradient(135deg, #ec4899, #f43f5e)' },
  { id: 'av_6', name: 'Neon Beat', initials: 'NB', bg: 'linear-gradient(135deg, #eab308, #f97316)' }
];

export const TELEGRAM_STYLE_USERNAMES = [
  { username: 'CosmicTiger_44', tags: ['music', 'memes'] },
  { username: 'QuietStorm_91', tags: ['books', 'coding'] },
  { username: 'Delhite_22', tags: ['explore', 'food'] },
  { username: 'BlueFalcon_99', tags: ['tech', 'startups'] },
  { username: 'MetroNomad_07', tags: ['travel', 'photography'] },
  { username: 'UrbanChai_33', tags: ['design', 'coffee'] },
  { username: 'DURider_18', tags: ['du_campus', 'spotify'] },
  { username: 'CricketFever_11', tags: ['cricket', 'gaming'] },
  { username: 'CodeNinja_08', tags: ['coding', 'gaming'] },
  { username: 'BiryaniLove_27', tags: ['food', 'travel'] },
  { username: 'GamerX_99', tags: ['gaming', 'anime'] },
  { username: 'BookWorm_13', tags: ['books', 'music'] },
  { username: 'ChaiPoint_45', tags: ['chai', 'memes'] },
  { username: 'FitnessFreak_22', tags: ['fitness', 'yoga'] },
];

export function getRandomTelegramProfile() {
  const item = TELEGRAM_STYLE_USERNAMES[Math.floor(Math.random() * TELEGRAM_STYLE_USERNAMES.length)];
  const avatar = AVATAR_PALETTE[Math.floor(Math.random() * AVATAR_PALETTE.length)];
  return {
    username: `@${item.username}`,
    pseudonym: item.username,
    avatarId: avatar.id,
    avatarBg: avatar.bg,
    interestTags: item.tags
  };
}
