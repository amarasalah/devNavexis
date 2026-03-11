// Data extracted from Excel on 2026-02-07T23:27:19.293Z

const EXCEL_TRUCKS = [
  {
    "id": "t1",
    "matricule": "8565 TU 257",
    "type": "PLATEAU",
    "chargesFixes": 400,
    "montantAssurance": 32,
    "montantTaxe": 20,
    "chargePersonnel": 80
  },
  {
    "id": "t2",
    "matricule": "8563 TU 257",
    "type": "PLATEAU",
    "chargesFixes": 400,
    "montantAssurance": 32,
    "montantTaxe": 20,
    "chargePersonnel": 80
  },
  {
    "id": "t3",
    "matricule": "5305 TU 236",
    "type": "PLATEAU",
    "chargesFixes": 80,
    "montantAssurance": 20,
    "montantTaxe": 20,
    "chargePersonnel": 80
  },
  {
    "id": "t4",
    "matricule": "924 TU 98",
    "type": "PLATEAU",
    "chargesFixes": 80,
    "montantAssurance": 20,
    "montantTaxe": 20,
    "chargePersonnel": 80
  },
  {
    "id": "t5",
    "matricule": "6980 TU 101",
    "type": "PLATEAU",
    "chargesFixes": 80,
    "montantAssurance": 20,
    "montantTaxe": 20,
    "chargePersonnel": 80
  },
  {
    "id": "t6",
    "matricule": "7775 TU 252",
    "type": "PLATEAU",
    "chargesFixes": 400,
    "montantAssurance": 20,
    "montantTaxe": 20,
    "chargePersonnel": 80
  },
  {
    "id": "t7",
    "matricule": "4176 TU 250",
    "type": "PLATEAU",
    "chargesFixes": 400,
    "montantAssurance": 32,
    "montantTaxe": 20,
    "chargePersonnel": 80
  },
  {
    "id": "t8",
    "matricule": "3380 TU 104",
    "type": "PLATEAU",
    "chargesFixes": 80,
    "montantAssurance": 20,
    "montantTaxe": 20,
    "chargePersonnel": 80
  },
  {
    "id": "t9",
    "matricule": "446 TU 228",
    "type": "PLATEAU",
    "chargesFixes": 80,
    "montantAssurance": 20,
    "montantTaxe": 20,
    "chargePersonnel": 80
  },
  {
    "id": "t10",
    "matricule": "7243 TU 75",
    "type": "PLATEAU",
    "chargesFixes": 80,
    "montantAssurance": 20,
    "montantTaxe": 20,
    "chargePersonnel": 80
  },
  {
    "id": "t11",
    "matricule": "4188 TU 80",
    "type": "PLATEAU",
    "chargesFixes": 80,
    "montantAssurance": 20,
    "montantTaxe": 20,
    "chargePersonnel": 80
  },
  {
    "id": "t12",
    "matricule": "2318 TU 155",
    "type": "BENNE",
    "chargesFixes": 80,
    "montantAssurance": 20,
    "montantTaxe": 20,
    "chargePersonnel": 80
  },
  {
    "id": "t13",
    "matricule": "788 TU 99",
    "type": "BENNE",
    "chargesFixes": 80,
    "montantAssurance": 20,
    "montantTaxe": 20,
    "chargePersonnel": 80
  },
  {
    "id": "t14",
    "matricule": "8564 TU 257",
    "type": "BENNE",
    "chargesFixes": 400,
    "montantAssurance": 32,
    "montantTaxe": 20,
    "chargePersonnel": 80
  },
  {
    "id": "t15",
    "matricule": "8566 TU 257",
    "type": "BENNE",
    "chargesFixes": 400,
    "montantAssurance": 32,
    "montantTaxe": 20,
    "chargePersonnel": 80
  }
];

const EXCEL_DRIVERS = [
  {
    "id": "d1",
    "nom": "CHOKAIRI",
    "camionId": "t1"
  },
  {
    "id": "d2",
    "nom": "LASSAD CHATAOUI",
    "camionId": "t2"
  },
  {
    "id": "d3",
    "nom": "HAMZA",
    "camionId": "t3"
  },
  {
    "id": "d4",
    "nom": "IKRAMI",
    "camionId": "t4"
  },
  {
    "id": "d5",
    "nom": "ABDELBARI",
    "camionId": "t5"
  },
  {
    "id": "d6",
    "nom": "JAMIL",
    "camionId": "t6"
  },
  {
    "id": "d7",
    "nom": "HEDI",
    "camionId": "t7"
  },
  {
    "id": "d8",
    "nom": "MALEK",
    "camionId": "t8"
  },
  {
    "id": "d9",
    "nom": "LASSAD AMRI",
    "camionId": "t10"
  },
  {
    "id": "d10",
    "nom": "SAMI",
    "camionId": "t11"
  },
  {
    "id": "d11",
    "nom": "KAMEL CH",
    "camionId": "t12"
  },
  {
    "id": "d12",
    "nom": "KAMEL ZAY",
    "camionId": "t13"
  },
  {
    "id": "d13",
    "nom": "CHOKRI THAMER",
    "camionId": "t14"
  },
  {
    "id": "d14",
    "nom": "HSAN REBII",
    "camionId": "t15"
  }
];

const EXCEL_ENTRIES = [
  {
    "id": "e1",
    "date": "2026-02-02",
    "camionId": "t1",
    "chauffeurId": "d1",
    "destination": "TUNIS",
    "kilometrage": 800,
    "quantiteGasoil": 240,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 500,
    "remarques": ""
  },
  {
    "id": "e2",
    "date": "2026-02-02",
    "camionId": "t2",
    "chauffeurId": "d2",
    "destination": "TUNIS",
    "kilometrage": 800,
    "quantiteGasoil": 240,
    "prixGasoilLitre": 2,
    "maintenance": 1070,
    "prixLivraison": 500,
    "remarques": "VIDANGE"
  },
  {
    "id": "e3",
    "date": "2026-02-02",
    "camionId": "t3",
    "chauffeurId": "d3",
    "destination": "SOUSSE",
    "kilometrage": 300,
    "quantiteGasoil": 120,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 590,
    "remarques": ""
  },
  {
    "id": "e4",
    "date": "2026-02-02",
    "camionId": "t4",
    "chauffeurId": "d4",
    "destination": "DJERBA",
    "kilometrage": 340,
    "quantiteGasoil": 120,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 590,
    "remarques": ""
  },
  {
    "id": "e5",
    "date": "2026-02-02",
    "camionId": "t5",
    "chauffeurId": "d5",
    "destination": "KEBILI/GABES",
    "kilometrage": 434,
    "quantiteGasoil": 125,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 650,
    "remarques": ""
  },
  {
    "id": "e6",
    "date": "2026-02-02",
    "camionId": "t6",
    "chauffeurId": "d6",
    "destination": "MEHDIA/TUNIS",
    "kilometrage": 1220,
    "quantiteGasoil": 360,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 1090,
    "remarques": ""
  },
  {
    "id": "e7",
    "date": "2026-02-02",
    "camionId": "t7",
    "chauffeurId": "d7",
    "destination": "TUNIS",
    "kilometrage": 800,
    "quantiteGasoil": 240,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 500,
    "remarques": ""
  },
  {
    "id": "e8",
    "date": "2026-02-02",
    "camionId": "t10",
    "chauffeurId": "d9",
    "destination": "OUDHREF",
    "kilometrage": 80,
    "quantiteGasoil": 30,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 200,
    "remarques": ""
  },
  {
    "id": "e9",
    "date": "2026-02-02",
    "camionId": "t12",
    "chauffeurId": "d11",
    "destination": "CHAGRA/ CHAGRA",
    "kilometrage": 200,
    "quantiteGasoil": 65,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 500,
    "remarques": ""
  },
  {
    "id": "e10",
    "date": "2026-02-02",
    "camionId": "t14",
    "chauffeurId": "d13",
    "destination": "FAIEDH/SP/2SB",
    "kilometrage": 400,
    "quantiteGasoil": 135,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 980,
    "remarques": ""
  },
  {
    "id": "e11",
    "date": "2026-02-02",
    "camionId": "t15",
    "chauffeurId": "d14",
    "destination": "FAIEDH/SP/2SB",
    "kilometrage": 400,
    "quantiteGasoil": 135,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 980,
    "remarques": ""
  },
  {
    "id": "e12",
    "date": "2026-02-03",
    "camionId": "t2",
    "chauffeurId": {
      "id": "d2",
      "nom": "LASSAD CHATAOUI",
      "camionId": "t2"
    },
    "destination": "GAFSSA",
    "kilometrage": 300,
    "quantiteGasoil": 90,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 600,
    "remarques": ""
  },
  {
    "id": "e13",
    "date": "2026-02-03",
    "camionId": "t3",
    "chauffeurId": {
      "id": "d3",
      "nom": "HAMZA",
      "camionId": "t3"
    },
    "destination": "ZARZIS",
    "kilometrage": 414,
    "quantiteGasoil": 145,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 524,
    "remarques": ""
  },
  {
    "id": "e14",
    "date": "2026-02-03",
    "camionId": "t4",
    "chauffeurId": {
      "id": "d4",
      "nom": "IKRAMI",
      "camionId": "t4"
    },
    "destination": "DJERBA",
    "kilometrage": 380,
    "quantiteGasoil": 120,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 553,
    "remarques": ""
  },
  {
    "id": "e15",
    "date": "2026-02-03",
    "camionId": "t5",
    "chauffeurId": {
      "id": "d5",
      "nom": "ABDELBARI",
      "camionId": "t5"
    },
    "destination": "ELHAMMA",
    "kilometrage": 180,
    "quantiteGasoil": 40,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 234,
    "remarques": ""
  },
  {
    "id": "e16",
    "date": "2026-02-03",
    "camionId": "t6",
    "chauffeurId": {
      "id": "d6",
      "nom": "JAMIL",
      "camionId": "t6"
    },
    "destination": "",
    "kilometrage": 0,
    "quantiteGasoil": 0,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 1090,
    "remarques": ""
  },
  {
    "id": "e17",
    "date": "2026-02-03",
    "camionId": "t10",
    "chauffeurId": {
      "id": "d9",
      "nom": "LASSAD AMRI",
      "camionId": "t10"
    },
    "destination": "OUDHREF",
    "kilometrage": 80,
    "quantiteGasoil": 30,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 200,
    "remarques": ""
  },
  {
    "id": "e18",
    "date": "2026-02-03",
    "camionId": "t12",
    "chauffeurId": {
      "id": "d11",
      "nom": "KAMEL CH",
      "camionId": "t12"
    },
    "destination": "CHAGRA/SB",
    "kilometrage": 320,
    "quantiteGasoil": 120,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 800,
    "remarques": ""
  },
  {
    "id": "e19",
    "date": "2026-02-03",
    "camionId": "t14",
    "chauffeurId": {
      "id": "d13",
      "nom": "CHOKRI THAMER",
      "camionId": "t14"
    },
    "destination": "FAIEDH/SP/2SB",
    "kilometrage": 300,
    "quantiteGasoil": 100,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 960,
    "remarques": ""
  },
  {
    "id": "e20",
    "date": "2026-02-03",
    "camionId": "t15",
    "chauffeurId": {
      "id": "d14",
      "nom": "HSAN REBII",
      "camionId": "t15"
    },
    "destination": "FAIEDH/SP/2SB",
    "kilometrage": 300,
    "quantiteGasoil": 100,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 960,
    "remarques": ""
  },
  {
    "id": "e21",
    "date": "2026-02-04",
    "camionId": "t1",
    "chauffeurId": {
      "id": "d1",
      "nom": "CHOKAIRI",
      "camionId": "t1"
    },
    "destination": "ZARZIS",
    "kilometrage": 414,
    "quantiteGasoil": 125,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 524,
    "remarques": ""
  },
  {
    "id": "e22",
    "date": "2026-02-04",
    "camionId": "t2",
    "chauffeurId": {
      "id": "d2",
      "nom": "LASSAD CHATAOUI",
      "camionId": "t2"
    },
    "destination": "TUNIS",
    "kilometrage": 414,
    "quantiteGasoil": 125,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 524,
    "remarques": ""
  },
  {
    "id": "e23",
    "date": "2026-02-04",
    "camionId": "t3",
    "chauffeurId": {
      "id": "d3",
      "nom": "HAMZA",
      "camionId": "t3"
    },
    "destination": "OUDHREF",
    "kilometrage": 80,
    "quantiteGasoil": 30,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 187,
    "remarques": ""
  },
  {
    "id": "e24",
    "date": "2026-02-04",
    "camionId": "t4",
    "chauffeurId": {
      "id": "d4",
      "nom": "IKRAMI",
      "camionId": "t4"
    },
    "destination": "DJERBA",
    "kilometrage": 380,
    "quantiteGasoil": 120,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 553,
    "remarques": ""
  },
  {
    "id": "e25",
    "date": "2026-02-04",
    "camionId": "t5",
    "chauffeurId": {
      "id": "d5",
      "nom": "ABDELBARI",
      "camionId": "t5"
    },
    "destination": "GABES",
    "kilometrage": 140,
    "quantiteGasoil": 40,
    "prixGasoilLitre": 2,
    "maintenance": 420,
    "prixLivraison": 234,
    "remarques": ""
  },
  {
    "id": "e26",
    "date": "2026-02-04",
    "camionId": "t7",
    "chauffeurId": {
      "id": "d7",
      "nom": "HEDI",
      "camionId": "t7"
    },
    "destination": "BENGUERDENE",
    "kilometrage": 440,
    "quantiteGasoil": 140,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 670,
    "remarques": ""
  },
  {
    "id": "e27",
    "date": "2026-02-04",
    "camionId": "t9",
    "chauffeurId": null,
    "destination": "GABES",
    "kilometrage": 140,
    "quantiteGasoil": 40,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 234,
    "remarques": ""
  },
  {
    "id": "e28",
    "date": "2026-02-04",
    "camionId": "t12",
    "chauffeurId": {
      "id": "d11",
      "nom": "KAMEL CH",
      "camionId": "t12"
    },
    "destination": "CHAGRA/ SB",
    "kilometrage": 320,
    "quantiteGasoil": 120,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 800,
    "remarques": ""
  },
  {
    "id": "e29",
    "date": "2026-02-04",
    "camionId": "t14",
    "chauffeurId": {
      "id": "d13",
      "nom": "CHOKRI THAMER",
      "camionId": "t14"
    },
    "destination": "FAIEDH/SP/2SB",
    "kilometrage": 400,
    "quantiteGasoil": 135,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 980,
    "remarques": ""
  },
  {
    "id": "e30",
    "date": "2026-02-04",
    "camionId": "t15",
    "chauffeurId": {
      "id": "d14",
      "nom": "HSAN REBII",
      "camionId": "t15"
    },
    "destination": "FAIEDH/SP/2SB",
    "kilometrage": 400,
    "quantiteGasoil": 135,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 980,
    "remarques": ""
  },
  {
    "id": "e31",
    "date": "2026-02-05",
    "camionId": "t1",
    "chauffeurId": {
      "id": "d1",
      "nom": "CHOKAIRI",
      "camionId": "t1"
    },
    "destination": "GHANOUCH",
    "kilometrage": 130,
    "quantiteGasoil": 40,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 234,
    "remarques": ""
  },
  {
    "id": "e32",
    "date": "2026-02-05",
    "camionId": "t2",
    "chauffeurId": {
      "id": "d2",
      "nom": "LASSAD CHATAOUI",
      "camionId": "t2"
    },
    "destination": "DJERBA",
    "kilometrage": 380,
    "quantiteGasoil": 110,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 591,
    "remarques": ""
  },
  {
    "id": "e33",
    "date": "2026-02-05",
    "camionId": "t4",
    "chauffeurId": {
      "id": "d4",
      "nom": "IKRAMI",
      "camionId": "t4"
    },
    "destination": "DJERBA",
    "kilometrage": 380,
    "quantiteGasoil": 120,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 591,
    "remarques": ""
  },
  {
    "id": "e34",
    "date": "2026-02-05",
    "camionId": "t6",
    "chauffeurId": {
      "id": "d6",
      "nom": "JAMIL",
      "camionId": "t6"
    },
    "destination": "GABES/DJERBA",
    "kilometrage": 520,
    "quantiteGasoil": 160,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 841,
    "remarques": ""
  },
  {
    "id": "e35",
    "date": "2026-02-05",
    "camionId": "t7",
    "chauffeurId": {
      "id": "d7",
      "nom": "HEDI",
      "camionId": "t7"
    },
    "destination": "MAHDIA",
    "kilometrage": 450,
    "quantiteGasoil": 140,
    "prixGasoilLitre": 2,
    "maintenance": 1546,
    "prixLivraison": 590,
    "remarques": "VIDANGE"
  },
  {
    "id": "e36",
    "date": "2026-02-05",
    "camionId": "t12",
    "chauffeurId": {
      "id": "d11",
      "nom": "KAMEL CH",
      "camionId": "t12"
    },
    "destination": "CHAGRA/ SB",
    "kilometrage": 320,
    "quantiteGasoil": 120,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 800,
    "remarques": ""
  },
  {
    "id": "e37",
    "date": "2026-02-05",
    "camionId": "t14",
    "chauffeurId": {
      "id": "d13",
      "nom": "CHOKRI THAMER",
      "camionId": "t14"
    },
    "destination": "SUDB/SB/HICHA/SP",
    "kilometrage": 200,
    "quantiteGasoil": 60,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 800,
    "remarques": ""
  },
  {
    "id": "e38",
    "date": "2026-02-05",
    "camionId": "t15",
    "chauffeurId": {
      "id": "d14",
      "nom": "HSAN REBII",
      "camionId": "t15"
    },
    "destination": "FAYEDH/FAYEDH",
    "kilometrage": 300,
    "quantiteGasoil": 100,
    "prixGasoilLitre": 2,
    "maintenance": 0,
    "prixLivraison": 960,
    "remarques": ""
  }
];

const EXCEL_SETTINGS = { defaultFuelPrice: 2, currency: 'TND' };
