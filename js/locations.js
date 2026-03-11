/**
 * TUNISIA LOCATIONS MODULE
 * Complete list of 24 Governorates and their Delegations with GPS coordinates
 * Coordinates are for governorate capitals (will be used for distance estimation)
 */

// GPS Coordinates for each governorate capital
const GouvernoratCoordinates = {
    "Ariana": { lat: 36.86250, lng: 10.19556 },
    "Béja": { lat: 36.73333, lng: 9.18333 },
    "Ben Arous": { lat: 36.75333, lng: 10.22220 },
    "Bizerte": { lat: 37.29000, lng: 9.87000 },
    "Gabès": { lat: 33.88333, lng: 10.11667 },
    "Gafsa": { lat: 34.42500, lng: 8.78417 },
    "Jendouba": { lat: 36.50111, lng: 8.77944 },
    "Kairouan": { lat: 35.68000, lng: 10.10000 },
    "Kasserine": { lat: 35.18000, lng: 8.83000 },
    "Kébili": { lat: 33.70194, lng: 8.97361 },
    "Kef": { lat: 36.19000, lng: 8.71000 },
    "Mahdia": { lat: 35.52000, lng: 11.07000 },
    "Manouba": { lat: 36.80778, lng: 10.10111 },
    "Médenine": { lat: 33.35000, lng: 10.49000 },
    "Monastir": { lat: 35.79000, lng: 10.82000 },
    "Nabeul": { lat: 36.45000, lng: 10.73333 },
    "Sfax": { lat: 34.74056, lng: 10.76028 },
    "Sidi Bouzid": { lat: 35.04028, lng: 9.49361 },
    "Siliana": { lat: 36.08333, lng: 9.36667 },
    "Sousse": { lat: 35.82556, lng: 10.64111 },
    "Tataouine": { lat: 32.93333, lng: 10.45000 },
    "Tozeur": { lat: 33.93000, lng: 8.13000 },
    "Tunis": { lat: 36.80278, lng: 10.17972 },
    "Zaghouan": { lat: 36.40000, lng: 10.14000 }
};

// Tunisia Locations with delegations
const DelegationCoordinates = {
    "Ariana Ville": {
        "lat": 36.866474,
        "lng": 10.164726
    },
    "Ettadhamen": {
        "lat": 36.839821,
        "lng": 10.099205
    },
    "La Soukra": {
        "lat": 36.883618,
        "lng": 10.240874
    },
    "M'nihla": {
        "lat": 36.866331,
        "lng": 10.089634
    },
    "Raoued": {
        "lat": 36.931944,
        "lng": 10.160278
    },
    "Sidi Thabet": {
        "lat": 36.898614,
        "lng": 10.030632
    },
    "Amdoun": {
        "lat": 36.839167,
        "lng": 9.081111
    },
    "B\u00e9ja Nord": {
        "lat": 36.748,
        "lng": 9.183
    },
    "B\u00e9ja Sud": {
        "lat": 36.710,
        "lng": 9.183
    },
    "Goubellat": {
        "lat": 36.534167,
        "lng": 9.6
    },
    "Nefza": {
        "lat": 37.074444,
        "lng": 9.085833
    },
    "Teboursouk": {
        "lat": 36.458038,
        "lng": 9.249001
    },
    "Testour": {
        "lat": 36.552305,
        "lng": 9.444303
    },
    "Thibar": {
        "lat": 36.611944,
        "lng": 9.059722
    },
    "Ben Arous": {
        "lat": 36.748333,
        "lng": 10.2225
    },
    "El Mourouj": {
        "lat": 36.739889,
        "lng": 10.205
    },
    "Ezzahra": {
        "lat": 36.743333,
        "lng": 10.308333
    },
    "Fouchana": {
        "lat": 36.703889,
        "lng": 10.155
    },
    "Hammam-Lif": {
        "lat": 36.727778,
        "lng": 10.336111
    },
    "M\u00e9grine": {
        "lat": 36.781111,
        "lng": 10.238333
    },
    "Mornag": {
        "lat": 36.633333,
        "lng": 10.25
    },
    "Rad\u00e8s": {
        "lat": 36.766667,
        "lng": 10.283333
    },
    "Bizerte Nord": {
        "lat": 37.294,
        "lng": 9.874
    },
    "Bizerte Sud": {
        "lat": 37.255,
        "lng": 9.874
    },
    "El Alia": {
        "lat": 37.169167,
        "lng": 10.045
    },
    "Ghar el-Melh": {
        "lat": 37.166667,
        "lng": 10.193056
    },
    "Ghezala": {
        "lat": 37.116667,
        "lng": 9.533333
    },
    "Mateur": {
        "lat": 37.040278,
        "lng": 9.665556
    },
    "Menzel Bourguiba": {
        "lat": 37.15,
        "lng": 9.783333
    },
    "Menzel Jemil": {
        "lat": 37.233333,
        "lng": 9.916667
    },
    "Ras Jebel": {
        "lat": 37.214722,
        "lng": 10.121389
    },
    "Tinja": {
        "lat": 37.161667,
        "lng": 9.759444
    },
    "Utique": {
        "lat": 37.0525,
        "lng": 10.058889
    },
    "El Hamma": {
        "lat": 33.888889,
        "lng": 9.794444
    },
    "Gab\u00e8s M\u00e9dina": {
        "lat": 33.8863,
        "lng": 10.1128
    },
    "Gab\u00e8s Ouest": {
        "lat": 33.890,
        "lng": 10.070
    },
    "Gab\u00e8s Sud": {
        "lat": 33.860,
        "lng": 10.100
    },
    "Mareth": {
        "lat": 33.627778,
        "lng": 10.295833
    },
    "Matmata": {
        "lat": 33.542778,
        "lng": 9.974722
    },
    "Nouvelle Matmata": {
        "lat": 33.702222,
        "lng": 10.025278
    },
    "Belkhir": {
        "lat": 34.466667,
        "lng": 9.066667
    },
    "El Guettar": {
        "lat": 34.328333,
        "lng": 8.951944
    },
    "El Ksar": {
        "lat": 34.4,
        "lng": 8.816667
    },
    "Gafsa Nord": {
        "lat": 34.445,
        "lng": 8.784
    },
    "Gafsa Sud": {
        "lat": 34.405,
        "lng": 8.784
    },
    "M\u00e9tlaoui": {
        "lat": 34.325833,
        "lng": 8.401389
    },
    "Moular\u00e8s": {
        "lat": 34.494444,
        "lng": 8.251944
    },
    "Redeyef": {
        "lat": 34.383333,
        "lng": 8.15
    },
    "Sidi A\u00efch": {
        "lat": 34.6,
        "lng": 8.883333
    },
    "A\u00efn Draham": {
        "lat": 36.7775,
        "lng": 8.691944
    },
    "Bou Salem": {
        "lat": 36.611667,
        "lng": 8.968889
    },
    "Fernana": {
        "lat": 36.6525,
        "lng": 8.693056
    },
    "Ghardimaou": {
        "lat": 36.479444,
        "lng": 8.439722
    },
    "Jendouba Nord": {
        "lat": 36.521,
        "lng": 8.780
    },
    "Jendouba Sud": {
        "lat": 36.481,
        "lng": 8.780
    },
    "Tabarka": {
        "lat": 36.954444,
        "lng": 8.758056
    },
    "Bou Hajla": {
        "lat": 35.25,
        "lng": 10.016667
    },
    "Chebika": {
        "lat": 35.683333,
        "lng": 9.75
    },
    "Haffouz": {
        "lat": 35.633333,
        "lng": 9.666667
    },
    "Hajeb el-Ayoun": {
        "lat": 35.383333,
        "lng": 9.55
    },
    "Kairouan Nord": {
        "lat": 35.698,
        "lng": 10.096
    },
    "Kairouan Sud": {
        "lat": 35.658,
        "lng": 10.096
    },
    "Nasrallah": {
        "lat": 35.05,
        "lng": 9.733333
    },
    "Oueslatia": {
        "lat": 35.85,
        "lng": 9.6
    },
    "Sbikha": {
        "lat": 35.933333,
        "lng": 10.0
    },
    "El Ayoun": {
        "lat": 35.383333,
        "lng": 8.7
    },
    "F\u00e9riana": {
        "lat": 34.95,
        "lng": 8.583333
    },
    "Foussana": {
        "lat": 35.1,
        "lng": 8.666667
    },
    "Ha\u00efdra": {
        "lat": 35.5625,
        "lng": 8.494444
    },
    "Kasserine Nord": {
        "lat": 35.188,
        "lng": 8.830
    },
    "Kasserine Sud": {
        "lat": 35.148,
        "lng": 8.830
    },
    "Sbe\u00eftla": {
        "lat": 35.233333,
        "lng": 9.133333
    },
    "Sbiba": {
        "lat": 35.55,
        "lng": 9.066667
    },
    "Thala": {
        "lat": 35.575,
        "lng": 8.672222
    },
    "Douz Nord": {
        "lat": 33.479,
        "lng": 9.026
    },
    "Douz Sud": {
        "lat": 33.439,
        "lng": 9.026
    },
    "K\u00e9bili Nord": {
        "lat": 33.725,
        "lng": 8.972
    },
    "K\u00e9bili Sud": {
        "lat": 33.685,
        "lng": 8.772
    },
    "Dahmani": {
        "lat": 35.95,
        "lng": 8.816667
    },
    "El Ksour": {
        "lat": 35.8,
        "lng": 8.866667
    },
    "J\u00e9rissa": {
        "lat": 35.866667,
        "lng": 8.633333
    },
    "Kef Est": {
        "lat": 36.180,
        "lng": 8.731
    },
    "Kef Ouest": {
        "lat": 36.180,
        "lng": 8.691
    },
    "Nebeur": {
        "lat": 36.366667,
        "lng": 8.816667
    },
    "Sakiet Sidi Youssef": {
        "lat": 36.35,
        "lng": 8.35
    },
    "Sers": {
        "lat": 36.083333,
        "lng": 9.033333
    },
    "Tajerouine": {
        "lat": 35.883333,
        "lng": 8.616667
    },
    "Bou Merdes": {
        "lat": 35.55,
        "lng": 10.766667
    },
    "Chorbane": {
        "lat": 35.266667,
        "lng": 10.516667
    },
    "El Jem": {
        "lat": 35.296389,
        "lng": 10.711111
    },
    "Mahdia": {
        "lat": 35.504722,
        "lng": 11.062222
    },
    "Borj El Amri": {
        "lat": 36.75,
        "lng": 9.833333
    },
    "Douar Hicher": {
        "lat": 36.835,
        "lng": 10.066667
    },
    "Mornaguia": {
        "lat": 36.766667,
        "lng": 9.933333
    },
    "Oued Ellil": {
        "lat": 36.833333,
        "lng": 10.05
    },
    "Tebourba": {
        "lat": 36.829167,
        "lng": 9.841667
    },
    "Beni Khedache": {
        "lat": 33.25,
        "lng": 10.2
    },
    "M\u00e9denine Nord": {
        "lat": 33.375,
        "lng": 10.505
    },
    "M\u00e9denine Sud": {
        "lat": 33.335,
        "lng": 10.505
    },
    "Sidi Makhlouf": {
        "lat": 33.566667,
        "lng": 10.45
    },
    "Zarzis": {
        "lat": 33.503889,
        "lng": 11.112222
    },
    "Bekalta": {
        "lat": 35.616667,
        "lng": 11.033333
    },
    "Bembla": {
        "lat": 35.7,
        "lng": 10.783333
    },
    "Beni Hassen": {
        "lat": 35.566667,
        "lng": 10.733333
    },
    "Jemmal": {
        "lat": 35.625,
        "lng": 10.754167
    },
    "Monastir": {
        "lat": 35.764298,
        "lng": 10.809098
    },
    "Moknine": {
        "lat": 35.630556,
        "lng": 10.9
    },
    "Ouerdanine": {
        "lat": 35.783333,
        "lng": 10.683333
    },
    "Sahline": {
        "lat": 35.75,
        "lng": 10.733333
    },
    "Sayada-Lamta-Bou Hajar": {
        "lat": 35.666667,
        "lng": 10.883333
    },
    "Teboulba": {
        "lat": 35.640556,
        "lng": 10.961389
    },
    "Z\u00e9ramdine": {
        "lat": 35.583333,
        "lng": 10.7
    },
    "B\u00e9ni Khalled": {
        "lat": 36.65,
        "lng": 10.6
    },
    "B\u00e9ni Khiar": {
        "lat": 36.466667,
        "lng": 10.783333
    },
    "Bou Argoub": {
        "lat": 36.55,
        "lng": 10.55
    },
    "El Haouaria": {
        "lat": 37.05,
        "lng": 11.016667
    },
    "Grombalia": {
        "lat": 36.6,
        "lng": 10.5
    },
    "Hammamet": {
        "lat": 36.4,
        "lng": 10.616667
    },
    "K\u00e9libia": {
        "lat": 36.846111,
        "lng": 11.0975
    },
    "Korba": {
        "lat": 36.575278,
        "lng": 10.862222
    },
    "Menzel Bouzelfa": {
        "lat": 36.683333,
        "lng": 10.583333
    },
    "Menzel Temime": {
        "lat": 36.783333,
        "lng": 10.983333
    },
    "Nabeul": {
        "lat": 36.456065,
        "lng": 10.734616
    },
    "Soliman": {
        "lat": 36.7,
        "lng": 10.483333
    },
    "Takelsa": {
        "lat": 36.783333,
        "lng": 10.633333
    },
    "Agareb": {
        "lat": 34.733333,
        "lng": 10.516667
    },
    "Bir Ali Ben Kh\u00e9lifa": {
        "lat": 34.833333,
        "lng": 10.066667
    },
    "El Amra": {
        "lat": 34.9,
        "lng": 10.616667
    },
    "El Hencha": {
        "lat": 35.233333,
        "lng": 10.6
    },
    "Ghra\u00efba": {
        "lat": 34.55,
        "lng": 10.166667
    },
    "Menzel Chaker": {
        "lat": 34.966667,
        "lng": 10.366667
    },
    "Sakiet Edda\u00efer": {
        "lat": 34.816667,
        "lng": 10.766667
    },
    "Sakiet Ezzit": {
        "lat": 34.794444,
        "lng": 10.743333
    },
    "Sfax Sud": {
        "lat": 34.74,
        "lng": 10.76
    },
    "Bir el-Haffey": {
        "lat": 34.933333,
        "lng": 9.2
    },
    "Jilma": {
        "lat": 35.283333,
        "lng": 9.416667
    },
    "Menzel Bouza\u00efene": {
        "lat": 34.783333,
        "lng": 9.25
    },
    "Ouled Haffouz": {
        "lat": 35.183333,
        "lng": 9.2
    },
    "Regueb": {
        "lat": 34.85,
        "lng": 9.766667
    },
    "Sidi Bouzid Est": {
        "lat": 35.037,
        "lng": 9.505
    },
    "Sidi Bouzid Ouest": {
        "lat": 35.037,
        "lng": 9.465
    },
    "Souk Jedid": {
        "lat": 35.1,
        "lng": 9.316667
    },
    "Bargou": {
        "lat": 36.083333,
        "lng": 9.6
    },
    "Bou Arada": {
        "lat": 36.35,
        "lng": 9.616667
    },
    "El Aroussa": {
        "lat": 36.35,
        "lng": 9.383333
    },
    "Ga\u00e2four": {
        "lat": 36.283333,
        "lng": 9.416667
    },
    "Makthar": {
        "lat": 35.85,
        "lng": 9.2
    },
    "Siliana Nord": {
        "lat": 36.105,
        "lng": 9.370
    },
    "Siliana Sud": {
        "lat": 36.065,
        "lng": 9.370
    },
    "Akouda": {
        "lat": 35.871111,
        "lng": 10.563889
    },
    "Bouficha": {
        "lat": 36.266667,
        "lng": 10.4
    },
    "Enfidha": {
        "lat": 36.133333,
        "lng": 10.383333
    },
    "Hammam Sousse": {
        "lat": 35.861111,
        "lng": 10.597222
    },
    "Hergla": {
        "lat": 36.033333,
        "lng": 10.5
    },
    "Kondar": {
        "lat": 35.933333,
        "lng": 10.316667
    },
    "M'saken": {
        "lat": 35.729444,
        "lng": 10.58
    },
    "Sidi Bou Ali": {
        "lat": 35.966667,
        "lng": 10.466667
    },
    "Sousse Riadh": {
        "lat": 35.809444,
        "lng": 10.591667
    },
    "Bir Lahmar": {
        "lat": 33.2,
        "lng": 10.583333
    },
    "Dhehiba": {
        "lat": 32.0,
        "lng": 10.7
    },
    "Ghomrassen": {
        "lat": 33.05,
        "lng": 10.333333
    },
    "Remada": {
        "lat": 32.3,
        "lng": 10.383333
    },
    "Sm\u00e2r": {
        "lat": 33.116667,
        "lng": 10.783333
    },
    "Tataouine Nord": {
        "lat": 32.950,
        "lng": 10.451
    },
    "Tataouine Sud": {
        "lat": 32.910,
        "lng": 10.451
    },
    "Degueche": {
        "lat": 33.966667,
        "lng": 8.216667
    },
    "Nefta": {
        "lat": 33.873056,
        "lng": 7.883333
    },
    "Tameghza": {
        "lat": 34.383333,
        "lng": 7.933333
    },
    "Tozeur": {
        "lat": 33.919722,
        "lng": 8.133611
    },
    "Bab Bhar": {
        "lat": 36.798333,
        "lng": 10.18
    },
    "Bab Souika": {
        "lat": 36.8075,
        "lng": 10.166944
    },
    "Carthage": {
        "lat": 36.853611,
        "lng": 10.332222
    },
    "Cit\u00e9 El Khadra": {
        "lat": 36.8343,
        "lng": 10.199
    },
    "El Kram": {
        "lat": 36.833333,
        "lng": 10.316667
    },
    "El Menzah": {
        "lat": 36.845194,
        "lng": 10.176694
    },
    "El Omrane": {
        "lat": 36.82,
        "lng": 10.155
    },
    "El Omrane Sup\u00e9rieur": {
        "lat": 36.8225,
        "lng": 10.162222
    },
    "La Goulette": {
        "lat": 36.818889,
        "lng": 10.3
    },
    "La Marsa": {
        "lat": 36.8776,
        "lng": 10.3278
    },
    "Le Bardo": {
        "lat": 36.809278,
        "lng": 10.1395
    },
    "Sidi El B\u00e9chir": {
        "lat": 36.783333,
        "lng": 10.19
    },
    "Sidi Hassine": {
        "lat": 36.794444,
        "lng": 10.083333
    },
    "Bir Mcherga": {
        "lat": 36.516667,
        "lng": 10.016667
    },
    "El Fahs": {
        "lat": 36.376111,
        "lng": 9.904167
    },
    "Zaghouan": {
        "lat": 36.4,
        "lng": 10.15
    },
    "Kal\u00e2at el-Andalous": { "lat": 37.066667, "lng": 10.183333 },
    "Medjez el-Bab": { "lat": 36.649444, "lng": 9.609167 },
    "Boumhel": { "lat": 36.726, "lng": 10.227 },
    "Hammam Chott": { "lat": 36.740, "lng": 10.345 },
    "M'Hamdia": { "lat": 36.689444, "lng": 10.131389 },
    "Medina Jedida": { "lat": 36.753, "lng": 10.208 },
    "Djoumine": { "lat": 37.067, "lng": 9.583 },
    "Sejenane": { "lat": 37.055, "lng": 9.237 },
    "Zarzouna": { "lat": 37.267, "lng": 9.857 },
    "Ghannouch": { "lat": 33.933333, "lng": 10.066667 },
    "M\u00e9touia": { "lat": 33.961111, "lng": 10.005556 },
    "Menzel El Habib": { "lat": 34.125833, "lng": 9.703333 },
    "Oudhref": { "lat": 33.833, "lng": 10.000 },
    "Mdhilla": { "lat": 34.323333, "lng": 8.6025 },
    "Sened": { "lat": 34.392, "lng": 9.100 },
    "Balta-Bou Aouane": { "lat": 36.45, "lng": 8.966667 },
    "Oued Meliz": { "lat": 36.483, "lng": 8.583 },
    "A\u00efn Djeloula": { "lat": 35.483, "lng": 9.617 },
    "Echrarda": { "lat": 35.452222, "lng": 10.23 },
    "El Al\u00e2a": { "lat": 35.533, "lng": 9.833 },
    "Menzel Mehiri": { "lat": 35.350, "lng": 9.800 },
    "Hassi El Ferid": { "lat": 34.933333, "lng": 9.0 },
    "Jedelienne": { "lat": 35.616667, "lng": 9.183333 },
    "Majel Bel Abb\u00e8s": { "lat": 34.8, "lng": 8.833333 },
    "Ezzouhour": { "lat": 35.180, "lng": 8.825 },
    "Faouar": { "lat": 33.35, "lng": 8.616667 },
    "Rjim Maatoug": { "lat": 33.350, "lng": 8.150 },
    "Souk Lahad": { "lat": 33.750, "lng": 8.883 },
    "Kal\u00e2at Khasba": { "lat": 35.633333, "lng": 8.45 },
    "Kalaat Senan": { "lat": 35.95, "lng": 8.466667 },
    "Chebba": { "lat": 35.233333, "lng": 11.116667 },
    "Essouassi": { "lat": 35.350, "lng": 10.500 },
    "Hebira": { "lat": 35.417, "lng": 10.400 },
    "Ksour Essef": { "lat": 35.417, "lng": 10.983 },
    "Melloul\u00e8che": { "lat": 35.316667, "lng": 11.016667 },
    "Ouled Chamekh": { "lat": 35.4, "lng": 10.3 },
    "Rejiche": { "lat": 35.483, "lng": 11.017 },
    "Sidi Alouane": { "lat": 35.367, "lng": 10.867 },
    "El Batan": { "lat": 36.800, "lng": 9.850 },
    "Jedeida": { "lat": 36.850, "lng": 9.917 },
    "La Manouba": { "lat": 36.810, "lng": 10.100 },
    "Ben Gardane": { "lat": 33.133333, "lng": 11.216667 },
    "Djerba Ajim": { "lat": 33.717, "lng": 10.750 },
    "Djerba Houmt Souk": { "lat": 33.876, "lng": 10.857 },
    "Djerba Midoun": { "lat": 33.808, "lng": 10.958 },
    "Ksar Hellal": { "lat": 35.644167, "lng": 10.892778 },
    "Dar Cha\u00e2bane": { "lat": 36.467, "lng": 10.750 },
    "Jebiniana": { "lat": 35.033333, "lng": 10.9 },
    "Kerkennah": { "lat": 34.700, "lng": 11.167 },
    "Mahr\u00e8s": { "lat": 34.525, "lng": 10.500 },
    "Sfax M\u00e9dina": { "lat": 34.7375, "lng": 10.757778 },
    "Sfax Ouest": { "lat": 34.750, "lng": 10.717 },
    "Skhira": { "lat": 34.300, "lng": 10.067 },
    "Thyna": { "lat": 34.717, "lng": 10.733 },
    "Cebbala Ouled Asker": { "lat": 35.133333, "lng": 9.083333 },
    "Meknassy": { "lat": 34.617, "lng": 9.617 },
    "Sidi Ali Ben Aoun": { "lat": 34.667, "lng": 9.083 },
    "El Krib": { "lat": 36.283333, "lng": 9.183333 },
    "Kassra": { "lat": 35.816667, "lng": 9.366667 },
    "Rouhia": { "lat": 35.65, "lng": 9.0 },
    "Kalaa Kebira": { "lat": 35.866667, "lng": 10.533333 },
    "Kalaa Seghira": { "lat": 35.833333, "lng": 10.566667 },
    "Sidi El Hani": { "lat": 35.650, "lng": 10.317 },
    "Sousse Jawhara": { "lat": 35.817, "lng": 10.617 },
    "Sousse M\u00e9dina": { "lat": 35.828828, "lng": 10.640036 },
    "Hazoua": { "lat": 33.75, "lng": 7.833333 },
    "Djebel Jelloud": { "lat": 36.775, "lng": 10.195833 },
    "El Kabaria": { "lat": 36.767, "lng": 10.167 },
    "El Ouardia": { "lat": 36.783, "lng": 10.183 },
    "Hra\u00efria": { "lat": 36.775278, "lng": 10.102778 },
    "M\u00e9dina": { "lat": 36.8, "lng": 10.171667 },
    "S\u00e9joumi": { "lat": 36.783333, "lng": 10.133333 },
    "Nadhour": { "lat": 36.216667, "lng": 10.066667 },
    "Saouaf": { "lat": 36.350, "lng": 10.300 },
    "Zriba": { "lat": 36.3, "lng": 10.216667 }
};



const TunisiaLocations = {
    "Ariana": [
        "Ariana Ville", "Ettadhamen", "Kalâat el-Andalous", "La Soukra", "M'nihla", "Raoued", "Sidi Thabet"
    ],
    "Béja": [
        "Amdoun", "Béja Nord", "Béja Sud", "Goubellat", "Medjez el-Bab", "Nefza", "Teboursouk", "Testour", "Thibar"
    ],
    "Ben Arous": [
        "Ben Arous", "Boumhel", "El Mourouj", "Ezzahra", "Fouchana", "Hammam Chott", "Hammam-Lif", "M'Hamdia", "Medina Jedida", "Mégrine", "Mornag", "Radès"
    ],
    "Bizerte": [
        "Bizerte Nord", "Bizerte Sud", "Djoumine", "El Alia", "Ghar el-Melh", "Ghezala", "Mateur", "Menzel Bourguiba", "Menzel Jemil", "Ras Jebel", "Sejenane", "Tinja", "Utique", "Zarzouna"
    ],
    "Gabès": [
        "El Hamma", "Gabès Médina", "Gabès Ouest", "Gabès Sud", "Ghannouch", "Mareth", "Matmata", "Métouia", "Menzel El Habib", "Nouvelle Matmata", "Oudhref"
    ],
    "Gafsa": [
        "Belkhir", "El Guettar", "El Ksar", "Gafsa Nord", "Gafsa Sud", "Mdhilla", "Métlaoui", "Moularès", "Redeyef", "Sened", "Sidi Aïch"
    ],
    "Jendouba": [
        "Aïn Draham", "Balta-Bou Aouane", "Bou Salem", "Fernana", "Ghardimaou", "Jendouba Nord", "Jendouba Sud", "Oued Meliz", "Tabarka"
    ],
    "Kairouan": [
        "Aïn Djeloula", "Bou Hajla", "Chebika", "Echrarda", "El Alâa", "Haffouz", "Hajeb el-Ayoun", "Kairouan Nord", "Kairouan Sud", "Menzel Mehiri", "Nasrallah", "Oueslatia", "Sbikha"
    ],
    "Kasserine": [
        "El Ayoun", "Fériana", "Foussana", "Haïdra", "Hassi El Ferid", "Jedelienne", "Kasserine Nord", "Kasserine Sud", "Majel Bel Abbès", "Sbeïtla", "Sbiba", "Thala", "Ezzouhour"
    ],
    "Kébili": [
        "Douz Nord", "Douz Sud", "Faouar", "Kébili Nord", "Kébili Sud", "Rjim Maatoug", "Souk Lahad"
    ],
    "Kef": [
        "Dahmani", "El Ksour", "Jérissa", "Kalâat Khasba", "Kalaat Senan", "Kef Est", "Kef Ouest", "Nebeur", "Sakiet Sidi Youssef", "Sers", "Tajerouine"
    ],
    "Mahdia": [
        "Bou Merdes", "Chebba", "Chorbane", "El Jem", "Essouassi", "Hebira", "Ksour Essef", "Mahdia", "Melloulèche", "Ouled Chamekh", "Rejiche", "Sidi Alouane"
    ],
    "Manouba": [
        "Borj El Amri", "Douar Hicher", "El Batan", "Jedeida", "La Manouba", "Mornaguia", "Oued Ellil", "Tebourba"
    ],
    "Médenine": [
        "Ben Gardane", "Beni Khedache", "Djerba Ajim", "Djerba Houmt Souk", "Djerba Midoun", "Médenine Nord", "Médenine Sud", "Sidi Makhlouf", "Zarzis"
    ],
    "Monastir": [
        "Bekalta", "Bembla", "Beni Hassen", "Jemmal", "Ksar Hellal", "Monastir", "Moknine", "Ouerdanine", "Sahline", "Sayada-Lamta-Bou Hajar", "Teboulba", "Zéramdine"
    ],
    "Nabeul": [
        "Béni Khalled", "Béni Khiar", "Bou Argoub", "Dar Chaâbane", "El Haouaria", "Grombalia", "Hammamet", "Kélibia", "Korba", "Menzel Bouzelfa", "Menzel Temime", "Nabeul", "Soliman", "Takelsa"
    ],
    "Sfax": [
        "Agareb", "Bir Ali Ben Khélifa", "El Amra", "El Hencha", "Ghraïba", "Jebiniana", "Kerkennah", "Mahrès", "Menzel Chaker", "Sakiet Eddaïer", "Sakiet Ezzit", "Sfax Médina", "Sfax Ouest", "Sfax Sud", "Skhira", "Thyna"
    ],
    "Sidi Bouzid": [
        "Bir el-Haffey", "Cebbala Ouled Asker", "Jilma", "Meknassy", "Menzel Bouzaïene", "Ouled Haffouz", "Regueb", "Sidi Ali Ben Aoun", "Sidi Bouzid Est", "Sidi Bouzid Ouest", "Souk Jedid"
    ],
    "Siliana": [
        "Bargou", "Bou Arada", "El Aroussa", "El Krib", "Gaâfour", "Kassra", "Makthar", "Rouhia", "Siliana Nord", "Siliana Sud"
    ],
    "Sousse": [
        "Akouda", "Bouficha", "Enfidha", "Hammam Sousse", "Hergla", "Kalaa Kebira", "Kalaa Seghira", "Kondar", "M'saken", "Sidi Bou Ali", "Sidi El Hani", "Sousse Jawhara", "Sousse Médina", "Sousse Riadh"
    ],
    "Tataouine": [
        "Bir Lahmar", "Dhehiba", "Ghomrassen", "Remada", "Smâr", "Tataouine Nord", "Tataouine Sud"
    ],
    "Tozeur": [
        "Degueche", "Hazoua", "Nefta", "Tameghza", "Tozeur"
    ],
    "Tunis": [
        "Bab Bhar", "Bab Souika", "Carthage", "Cité El Khadra", "Djebel Jelloud", "El Kabaria", "El Kram", "El Menzah", "El Omrane", "El Omrane Supérieur", "El Ouardia", "Ezzouhour", "Hraïria", "La Goulette", "La Marsa", "Le Bardo", "Médina", "Séjoumi", "Sidi El Béchir", "Sidi Hassine"
    ],
    "Zaghouan": [
        "Bir Mcherga", "El Fahs", "Nadhour", "Saouaf", "Zaghouan", "Zriba"
    ]
};

// Get all governorates
function getGouvernorats() {
    return Object.keys(TunisiaLocations).sort();
}

// Get delegations for a specific governorate
function getDelegations(gouvernorat) {
    return TunisiaLocations[gouvernorat] || [];
}

// Get coordinates for a governorate
function getGouvernoratCoordinates(gouvernorat) {
    return GouvernoratCoordinates[gouvernorat] || null;
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg) {
    return deg * (Math.PI / 180);
}

function hashStringToSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function seededRandom(seed) {
    let x = seed >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
}

function getEstimatedDelegationCoordinates(gouvernorat, delegation) {
    const base = GouvernoratCoordinates[gouvernorat];
    if (!base) return null;
    if (!delegation) return base;

    const seed = hashStringToSeed(`${gouvernorat}|${delegation}`);
    const r1 = seededRandom(seed);
    const r2 = seededRandom(seed ^ 0x9e3779b9);

    const angle = r1 * 2 * Math.PI;
    const radiusKm = 5 + r2 * 25;

    const dLat = (radiusKm / 111) * Math.cos(angle);
    const latRad = toRad(base.lat);
    const dLng = (radiusKm / (111 * Math.max(0.2, Math.cos(latRad)))) * Math.sin(angle);

    return {
        lat: base.lat + dLat,
        lng: base.lng + dLng
    };
}

/**
 * Calculate road distance between two governorates
 * Uses straight-line distance with a road factor (typically 1.3-1.4 for Tunisia)
 * Returns distance in km, rounded to nearest integer
 */
function calculateRoadDistance(fromGouvernorat, toGouvernorat) {
    const from = GouvernoratCoordinates[fromGouvernorat];
    const to = GouvernoratCoordinates[toGouvernorat];

    if (!from || !to) {
        console.warn('Coordinates not found for:', fromGouvernorat, 'or', toGouvernorat);
        return 0;
    }

    // If same location
    if (fromGouvernorat === toGouvernorat) {
        return 20; // Default intra-city distance
    }

    // Calculate straight-line distance
    const straightLine = calculateDistance(from.lat, from.lng, to.lat, to.lng);

    // Apply road factor (roads are typically 30-40% longer than straight line)
    const roadFactor = 1.35;
    const roadDistance = Math.round(straightLine * roadFactor);

    return roadDistance;
}

/**
 * Get distance estimate between two locations (gouvernorat + delegation)
 * PRIORITY: Uses DelegationCoordinates first, falls back to GouvernoratCoordinates
 */
function getDistanceEstimate(fromGouvernorat, fromDelegation, toGouvernorat, toDelegation) {
    // Get coordinates using getDelegationCoordinates (which has estimation fallback)
    let fromCoord = getDelegationCoordinates(fromGouvernorat, fromDelegation);
    let toCoord = getDelegationCoordinates(toGouvernorat, toDelegation);

    // If we couldn't find coordinates, return 0
    if (!fromCoord || !toCoord) {
        console.warn('Coordinates not found for:', fromDelegation || fromGouvernorat, 'or', toDelegation || toGouvernorat);
        return 0;
    }

    // Same exact location (same delegation in same gouvernorat)
    if (fromDelegation && toDelegation &&
        fromDelegation === toDelegation &&
        fromGouvernorat === toGouvernorat) {
        return 10; // Intra-delegation distance
    }

    // Different delegations in same gouvernorat
    if (fromGouvernorat === toGouvernorat && fromDelegation !== toDelegation) {
        const straightLine = calculateDistance(fromCoord.lat, fromCoord.lng, toCoord.lat, toCoord.lng);
        const roadDistance = Math.round(straightLine * 1.35);
        return Math.max(15, roadDistance); // Minimum 15km between different delegations
    }

    // Different gouvernorats
    const straightLine = calculateDistance(fromCoord.lat, fromCoord.lng, toCoord.lat, toCoord.lng);
    const roadFactor = 1.35;
    const roadDistance = Math.round(straightLine * roadFactor);

    return Math.max(20, roadDistance); // Minimum 20km between different gouvernorats
}

/**
 * Get coordinates for a delegation (or gouvernorat as fallback)
 */
function getDelegationCoordinates(gouvernorat, delegation) {
    if (delegation && DelegationCoordinates[delegation]) {
        return DelegationCoordinates[delegation];
    }
    // Fallback: estimate delegation coordinates from gouvernorat center
    if (gouvernorat && delegation) {
        return getEstimatedDelegationCoordinates(gouvernorat, delegation);
    }
    return GouvernoratCoordinates[gouvernorat] || null;
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.TunisiaLocations = TunisiaLocations;
    window.GouvernoratCoordinates = GouvernoratCoordinates;
    window.DelegationCoordinates = DelegationCoordinates;
    window.getGouvernorats = getGouvernorats;
    window.getDelegations = getDelegations;
    window.getGouvernoratCoordinates = getGouvernoratCoordinates;
    window.getDelegationCoordinates = getDelegationCoordinates;
    window.calculateRoadDistance = calculateRoadDistance;
    window.getDistanceEstimate = getDistanceEstimate;
    window.calculateDistance = calculateDistance;
}

