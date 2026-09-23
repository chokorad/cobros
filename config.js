// ============================================================
//  CONFIGURACIÓN — lo único que tienes que editar
// ============================================================

// 1) Pega aquí el objeto que te da Firebase:
//    Consola → ⚙ Configuración del proyecto → Tus apps → App web → "firebaseConfig"
export const firebaseConfig = {
  apiKey: "AIzaSyCwp-hOdkS0CrNLYSjc2_CuNml4BNFTtSU",
  authDomain: "cobros-97f8b.firebaseapp.com",
  projectId: "cobros-97f8b",
  storageBucket: "cobros-97f8b.firebasestorage.app",
  messagingSenderId: "860344570793",
  appId: "1:860344570793:web:639a8707c6198533d36ab8"
};

// 2) Solo estos correos pueden entrar (déjalo vacío [] para permitir cualquiera).
//    Pon el mismo correo en firestore.rules.
export const CORREOS_PERMITIDOS = ["mariohquintero@gmail.com"];

// 3) Modelo de Gemini que interpreta el audio.
export const MODELO = "gemini-3.5-flash";

// 4) Lada que se antepone a números de 10 dígitos escritos sin "+".
//    52 = México. Para números de EE.UU. escríbelos con +1.
export const LADA_DEFAULT = "52";
