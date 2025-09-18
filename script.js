// ==========================================================
// ==============  Traductor Voz/Text → Señas  ==============
// ==========================================================

// Capturamos los elementos del HTML
const boton = document.getElementById('start');
const texto = document.getElementById('texto');
const videoSeña = document.getElementById('videoSeña');
const videoSource = document.getElementById('videoSource');
const entradaTexto = document.getElementById('entradaTexto');
const startText = document.getElementById('startText'); // Texto del botón

// Seguridad: verificar DOM
if (!videoSeña || !videoSource) {
  console.error('Faltan elementos videoSeña/videoSource en el HTML.');
}

// Ocultar el video al cargar la página
videoSeña.style.display = "none";
// Silenciar por defecto para mejorar compatibilidad autoplay en algunos navegadores
videoSeña.muted = true;

// Configuramos el reconocimiento de voz
const Recon = window.SpeechRecognition || window.webkitSpeechRecognition;
const reconocimiento = Recon ? new Recon() : null;
if (reconocimiento) {
  reconocimiento.lang = 'es-ES'; // Idioma español
}

// Iniciar micrófono
boton.addEventListener('click', () => {
  activarMicrofono();
  if (startText) startText.textContent = "Escuchando...";
  try {
    if (reconocimiento) reconocimiento.start();
    else alert('Reconocimiento de voz no disponible en este navegador.');
  } catch (err) {
    console.error('No se pudo iniciar reconocimiento:', err);
  }
});

// Resultado del reconocimiento
if (reconocimiento) {
  reconocimiento.onresult = (event) => {
    const speechText = (event.results[0][0].transcript || '').toLowerCase().trim();
    mostrarTextoReconocido(speechText);
    procesarTextoSecuencial(speechText);
  };
  reconocimiento.onend = () => {
    desactivarMicrofono();
    if (startText) startText.textContent = "Hablar";
  };
}

// Entrada por teclado (Enter)
if (entradaTexto) {
  entradaTexto.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const userInput = entradaTexto.value.toLowerCase().trim();
      mostrarTextoReconocido(userInput);
      procesarTextoSecuencial(userInput);
    }
  });
}

// ==========================================================
// ===============  Generadores / Utilidades  ===============
// ==========================================================

// Generador de conjugaciones regulares (simplificado pero completo en formas habituales)
function generarConjugacionesRegulares(infinitivo) {
  // devuelve array de formas relevantes (infinitivo, presente, pretérito, imperfecto, futuro, condicional,
  // gerundio, participio, compuestos con "he/has/ha/hemos/han")
  const res = new Set();
  infinitivo = infinitivo.toLowerCase();
  res.add(infinitivo);

  // identificar terminación
  const raiz = infinitivo.slice(0, -2);
  const term = infinitivo.slice(-2);

  // auxiliares
  const pers1 = {ar: ['o','as','a','amos','an'], er: ['o','es','e','emos','en'], ir: ['o','es','e','imos','en']};
  const pretRad = {ar: 'é', er: 'í', ir: 'í'}; // primera persona pretérito simplificado no para todos
  const pretSuffix = {ar: ['é','aste','ó','amos','aron'], er: ['í','iste','ió','imos','ieron'], ir: ['í','iste','ió','imos','ieron']};
  const imperf = {ar: ['aba','abas','aba','ábamos','aban'], er: ['ía','ías','ía','íamos','ían'], ir: ['ía','ías','ía','íamos','ían']};
  const futuroPref = ['aré','arás','ará','aremos','arán']; // we'll build by combining
  const condPref = ['aría','arías','aría','aríamos','arían'];

  // presente simple
  if (term === 'ar' || term === 'er' || term === 'ir') {
    const pres = pers1[term];
    ['o','as','a','amos','an'].forEach((s, idx) => {
      // construir forma simple (raíz + terminación personalizada)
      const ending = pres[idx];
      res.add(raiz + ending);
    });
    // pretérito simple
    pretSuffix[term].forEach(s => res.add(raiz + s));
    // imperfecto
    imperf[term].forEach(s => res.add(raiz + s));
    // futuro simple: raíz + é/ás/á/emos/án usando infinitivo como base (forma regular)
    ['é','ás','á','emos','án'].forEach(s => res.add(infinitivo + s));
    // condicional: infinitivo + ía/ías/ía/íamos/ían
    ['ía','ías','ía','íamos','ían'].forEach(s => res.add(infinitivo + s));
    // gerundio
    if (term === 'ar') res.add(raiz + 'ando');
    else res.add(raiz + 'iendo');
    // participio
    if (term === 'ar') res.add(raiz + 'ado');
    else res.add(raiz + 'ido');
    // compuestos con haber (he/has/ha/hemos/han)
    ['he','has','ha','hemos','han'].forEach(aux => {
      // participio(s) ya agregado
      const part = (term === 'ar') ? raiz + 'ado' : raiz + 'ido';
      res.add(`${aux} ${part}`);
    });
  } else {
    // si no termina en ar/er/ir, devolvemos mínimo
    res.add(infinitivo);
  }

  return Array.from(res);
}

// Normalizador simple para acentos comunes (para mapeos)
function normalizarSinTilde(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Añadir formas de una lista a otra sin duplicados (con y sin tilde)
function mergeFormas(targetArray, formas) {
  formas.forEach(f => {
    const fLower = String(f).toLowerCase();
    if (!targetArray.includes(fLower)) targetArray.push(fLower);
    const sin = normalizarSinTilde(fLower);
    if (!targetArray.includes(sin)) targetArray.push(sin);
  });
}

// ==========================================================
// ===============  Conjugaciones (completadas)  ============
// ==========================================================

// Vamos a mantener la estructura: clave (verbo) -> array de formas (ya normalizadas)
const conjugaciones = {};

// Lista de verbos regulares que queremos autoexpandir
const verbosRegulares = [
  'apurar','llegar','hablar','contar','narrar','explicar','trabajar','practicar','comprar','vender','pagar','grabar','amar','amar', 'ganar','practicar','vestir','desvestir','desnudarse'
];

// Genero automáticamente conjugaciones para los regulares
verbosRegulares.forEach(v => {
  const formas = generarConjugacionesRegulares(v);
  conjugaciones[v] = [];
  mergeFormas(conjugaciones[v], formas);
});

// Verbos irregulares / con formas complejas añadidas manualmente
// Decir (irregular)
conjugaciones['decir'] = [];
mergeFormas(conjugaciones['decir'], [
  'decir','digo','dices','dice','decimos','dicen',
  'dije','dijiste','dijo','dijimos','dijeron',
  'decía','decías','decíamos','decían',
  'diré','dirás','dirá','diremos','dirán',
  'diría','dirías','diríamos','dirían',
  'diciendo','dicho','he dicho','has dicho','ha dicho','hemos dicho','han dicho'
]);

// Estar (irregular auxiliar)
conjugaciones['estar'] = [];
mergeFormas(conjugaciones['estar'], [
  'estar','estoy','estás','está','estamos','están',
  'estuve','estuviste','estuvo','estuvimos','estuvieron',
  'estaba','estabas','estábamos','estaban',
  'estaré','estarás','estará','estaremos','estarán',
  'estaría','estarías','estaríamos','estarían',
  'estando','estado','he estado','has estado','ha estado','hemos estado','han estado'
]);

// Llegar (por si tiene irregularidad en pretérito)
conjugaciones['llegar'] = conjugaciones['llegar'] || [];
mergeFormas(conjugaciones['llegar'], generarConjugacionesRegulares('llegar'));

// Hablar (ya generado, aseguramos inclusiones)
conjugaciones['hablar'] = conjugaciones['hablar'] || [];
mergeFormas(conjugaciones['hablar'], generarConjugacionesRegulares('hablar'));

// Contar / Narrar / Explicar: si ya generados, asegurar
['contar','narrar','explicar','apurar'].forEach(v => {
  conjugaciones[v] = conjugaciones[v] || [];
  mergeFormas(conjugaciones[v], generarConjugacionesRegulares(v));
});

// Agregar 'amar' con todas sus formas (te pediste ejemplo explícito)
conjugaciones['amar'] = [];
mergeFormas(conjugaciones['amar'], [
  'amar','amo','amas','ama','amamos','aman',
  'amé','amaste','amó','amamos','amaron',
  'amaba','amabas','amábamos','amaban',
  'amaré','amarás','amará','amaremos','amarán',
  'amaría','amarías','amaríamos','amarían',
  'amando','amado','he amado','has amado','ha amado','hemos amado','han amado'
]);

// Puedes seguir añadiendo verbos irregulares manualmente de la misma forma.

// ==========================================================
// ==================  Palabras fijas  =======================
// ==========================================================

// Mapeo palabra -> nombre archivo (tal como están tus archivos en la carpeta "Palabras")
const palabrasFijas = {
  // básicas / variantes
  "lengua oral": "Lengua oral",
  "lenguaoral": "Lengua oral",
  "si": "Si",
  "sí": "Si",
  "no": "No",
  "negra": "No",
  "negar": "Negar",
  "negación": "Negar",
  "negarse": "Negar",
  "tambien": "Tambien",
  "también": "Tambien",
  "tampoco": "Tampoco",
  "yo": "Yo",
  "vos": "Vos",
  "ustedes": "Ustedes",
  "el": "El o Ella",
  "él": "El o Ella",
  "ella": "El o Ella",
  "nosotros": "Nosotros o Nosotras",
  "nosotras": "Nosotros o Nosotras",
  "hola": "hola",
  "hola.": "hola",

  // tiempo / frecuencia
  "ayer": "Ayer",
  "hoy": "Hoy",
  "mañana": "Mañana",
  "manana": "Mañana",
  "año": "Año",
  "ano": "Año",
  "año pasado": "Año Pasado",
  "ano pasado": "Año Pasado",
  "futuro": "Futuro",
  "pasado": "Pasado",
  "último": "Último",
  "ultimo": "Último",
  "minuto": "Minuto",
  "hora": "Hora",
  "mes": "Mes",
  "semana": "Semana",
  "domingo": "Domingo",
  "lunes": "Lunes",
  "martes": "Martes",
  "miercoles": "Miércoles",
  "miércoles": "Miércoles",
  "jueves": "Jueves",
  "viernes": "Viernes",
  "sabado": "Sabado",
  "sábado": "Sabado",
  "mediodia": "Mediodía",
  "mediodía": "Mediodía",
  "todavia": "Todavía",
  "todavía": "Todavía",
  "siempre": "Siempre",
  "rapido": "Rápido",
  "rápido": "Rápido",
  "despacio": "Despacio",
  "temprano": "Temprano",
  "tarde": "Tarde",
  "hasta": "Hasta",

  // direcciones/cualidades
  "cerca": "Cerca",
  "derecha": "Derecha",
  "izquierda": "Izquierda",
  "importante": "Importante",
  "limpio": "Limpio",

  // lugares / provincias / países / regiones (varios de tu lista)
  "argentina": "Argentina",
  "américa": "América",
  "america": "América",
  "buenosaires": "Buenos Aires",
  "buenos aires": "Buenos Aires",
  "buenos áires": "Buenos Aires",
  "corrientes": "Corrientes",
  "cordoba": "Córdoba",
  "córdoba": "Córdoba",
  "chaco": "Chaco",
  "chubut": "Chubut",
  "entre rios": "Entre Ríos",
  "entre ríos": "Entre Ríos",
  "formosa": "Formosa",
  "jujuy": "Jujuy",
  "la pampa": "La Pampa",
  "la pampa": "La Pampa",
  "la rioja": "La Rioja",
  "mendoza": "Mendoza",
  "misiones": "Misiones",
  "neuquen": "Neuquén",
  "neuquén": "Neuquén",
  "patagonia": "Patagonia",
  "rio negro": "Rio Negro",
  "salta": "Salta",
  "san juan": "San Juan",
  "san luis": "San Luis",
  "santa cruz": "Santa Cruz",
  "santa fe": "Santa Fe",
  "santiago del estero": "Santiago Del Estero",
  "tucuman": "Tucumán",
  "tucumán": "Tucumán",
  "tierra del fuego": "Tierra Del Fuego",
  "patagonia": "Patagonia",

  // profesiones / roles / personas (masculino/femenino)
  "abuelo": "Abuelo Abuela",
  "abuela": "Abuelo Abuela",
  "bombero": "Bombero Bombera",
  "bombera": "Bombero Bombera",
  "empleado": "Empleado Empleada",
  "empleada": "Empleado Empleada",
  "enfermero": "Enfermero Enfermera",
  "enfermera": "Enfermero Enfermera",
  "jefe": "Jefe Jefa",
  "jefa": "Jefe Jefa",
  "jubilado": "Jubilado Jubilada",
  "jubilada": "Jubilado Jubilada",
  "mama": "Mamá Madre Madres",
  "mamá": "Mamá Madre Madres",
  "madre": "Mamá Madre Madres",
  "padre": "Papá Padre Padres",
  "papa": "Papá Padre Padres",
  "papá": "Papá Padre Padres",
  "primo": "Primo Prima",
  "prima": "Primo Prima",
  "novio": "Novio Novia",
  "novia": "Novio Novia",
  "hermano": "Hermano Hermana",
  "hermana": "Hermano Hermana",
  "hijo": "Hijo Hija",
  "hija": "Hijo Hija",
  "nieto": "Nieto Nieta",
  "nieta": "Nieto Nieta",
  "sobrino": "Sobrino Sobrina",
  "sobrina": "Sobrino Sobrina",
  "sobrinos": "Sobrinos Sobrinas",
  "sobrinas": "Sobrinos Sobrinas",
  "viudo": "Viudo Viuda",
  "viuda": "Viudo Viuda",
  "señora": "Señora",

  // verbos / acciones (mapear a archivo que subiste)
  "comprar": "Comprar",
  "compré": "Comprar",
  "compras": "Comprar",
  "compran": "Comprar",
  "vender": "Vender",
  "vendes": "Vender",
  "venderé": "Vender",
  "trabajar": "Trabajar",
  "trabajo": "Trabajo",
  "trabajé": "Trabajar",
  "trabajamos": "Trabajo",
  "pagar": "Pagar",
  "pago": "Pagar",
  "pagaré": "Pagar",
  "pagaron": "Pagar",
  "practicar": "Practicar",
  "practico": "Practicar",
  "practiqué": "Practicar",
  "vestir": "Vestir",
  "vestirse": "Vestir",
  "vestí": "Vestir",
  "desvestir": "Desvestir",
  "desnudarse": "Desnudarse",
  "desnudar": "Desnudar",
  "desnudar": "Desnudar",
  "cantar": "Cantar",
  "bailar": "Bailar",

  // sustantivos / otros archivos exactos
  "documento": "Documento",
  "economía": "Economía",
  "economia": "Economía",
  "deuda": "Deuda",
  "negocio": "Negocio",
  "ganar": "Ganar",
  "ganancia": "Ganancia",
  "gratis": "Gratis",
  "ropa": "Ropa",
  "pulover": "Pulover",
  "remera": "Remera",
  "zapatilla": "Zapatilla",
  "zapato": "Zapato",
  "camiseta": "Camiseta",
  "música": "Música",
  "musica": "Música",
  "fútbol": "Fútbol",
  "futbol": "Fútbol",
  "hora": "Hora",
  "minuto": "Minuto",
  "mes": "Mes",
  "tiempo": "Tiempo",
  "semana": "Semana",
  "feriado": "Feriado O Fiesta",
  "fiesta": "Feriado O Fiesta",
  "policía": "Policía",
  "policia": "Policía",
  "política": "Política",
  "politica": "Política",
  "presidente": "Presidente",
  "representante": "Representante",
  "profesional": "Profesional O Profesión",
  "profesión": "Profesional O Profesión",
  "profesion": "Profesional O Profesión",

  // salud / médicos
  "medico": "Médico O Doctor",
  "médico": "Médico O Doctor",
  "doctor": "Médico O Doctor",

  // frases multi-palabra importantes
  "comoestas": "Comoestas",
  "como estás": "Comoestas",
  "como estas": "Comoestas",
  "como quieres": "Como Quieras",
  "comoquieres": "Como Quieras",
  "como quieres?": "Como Quieras",
  "como quieres?": "Como Quieras",
  "comotellamas": "Comotellamas",
  "como te llamas": "Comotellamas",
  "vos cómo te llamas": "Comotellamas",
  "me llamo luana": "llamoluana"
  // ... (puedes seguir agregando mapeos)
};

// Nota: si algún archivo aparece con espacios o mayúsculas en GitHub, el mapeo usa el nombre exacto de archivo que subiste.
// Si tenés nombres con mayúsculas o espacios distintos, ajustá aquí para que coincida exactamente el string.

// ==========================================================
// =========  Procesamiento secuencial (con frases) =========
// ==========================================================

function procesarTextoSecuencial(text) {
  if (!text) {
    videoSeña.style.display = "none";
    return;
  }

  // normalizar y dividir
  text = text.trim().toLowerCase();
  const palabras = text.split(/\s+/);
  const videosAReproducir = [];

  // ---- Frases fijas multi-palabra (prioritarias) ----
  // (buscar includes para frases compuestas)
  if (text.includes("como estas") || text.includes("cómo estás") || text.includes("comoestas")) {
    videosAReproducir.push("Palabras/Comoestas.mp4");
  }
  if (text.includes("como quieres") || text.includes("cómo quieres") || text.includes("comoquieres")) {
    videosAReproducir.push("Palabras/Como Quieras.mp4");
  }
  if (text.includes("como te llamas") || text.includes("vos cómo te llamas") || text.includes("comotellamas")) {
    videosAReproducir.push("Palabras/Comotellamas.mp4");
  }
  if (text.includes("me llamo luana") || text.includes("llamoluana")) {
    videosAReproducir.push("Palabras/llamoluana.mp4");
  }
  if (text.includes("lo siento")) videosAReproducir.push("Palabras/Lo Siento.mp4");
  if (text.includes("hace poco")) videosAReproducir.push("Palabras/Hace Poco.mp4");
  if (text.includes("a veces")) videosAReproducir.push("Palabras/A Veces.mp4");
  if (text.includes("toda la noche") || text.includes("todalanoche")) videosAReproducir.push("Palabras/Todalanoche.mp4");
  if (text.includes("todos los dias") || text.includes("todos los días") || text.includes("todoslosdias")) videosAReproducir.push("Palabras/Todoslosdias.mp4");
  if (text.includes("primera vez") || text.includes("primeravez")) videosAReproducir.push("Palabras/Primeravez.mp4");
  if (text.includes("año pasado") || text.includes("ano pasado")) videosAReproducir.push("Palabras/Año Pasado.mp4");

  // ---- Analizar palabra por palabra ----
  for (let palabra of palabras) {
    palabra = palabra.trim();
    if (!palabra) continue;

    // 1) saludos / exactos
    if (palabra === 'hola') {
      videosAReproducir.push("Palabras/hola.mp4");
      continue;
    }

    // 2) letras (letra a, a, letra ch, etc.)
    const letras = ["a","b","c","d","e","f","g","h","i","j","k","l","ll","m","n","ñ","o","p","q","r","s","t","u","v","w","x","y","z","ch"];
    if (letras.includes(palabra) || palabra.startsWith('letra')) {
      // manejar "letra a" o "a"
      const cleaned = palabra.startsWith('letra') ? palabra.replace('letra','').trim() : palabra;
      const letraKey = cleaned.toUpperCase().replace(' ','');
      // normalizar CH/LL especiales
      const name = `Palabras/letra${letraKey}.mp4`;
      videosAReproducir.push(name);
      continue;
    }

    // 3) verbos con conjugaciones (buscar en conjugaciones)
    let matched = false;
    for (let verbo in conjugaciones) {
      if (conjugaciones[verbo].includes(palabra)) {
        // resolver nombre de archivo: si verbo es "contar" o "narrar" -> "Contar O Narrar"
        const nombreArchivo = (verbo === "contar" || verbo === "narrar") ? "Contar O Narrar" : (verbo.charAt(0).toUpperCase() + verbo.slice(1));
        videosAReproducir.push(`Palabras/${nombreArchivo}.mp4`);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // 4) palabras fijas mapeadas a archivos
    const keyNormal = palabra;
    if (palabrasFijas[keyNormal]) {
      let fichero = palabrasFijas[keyNormal];
      // si el mapeo ya devuelve nombre con extensión o con mayúsculas, respetar
      const ruta = fichero.toString().startsWith('Palabras/') ? fichero : `Palabras/${fichero}.mp4`;
      videosAReproducir.push(ruta);
      continue;
    }

    // 5) archivos de una palabra predefinidos (lista complementaria)
    const archivosUnaPalabra = [
      "ayer","hoy","mañana","manana","futuro","pasado","ultimo","último",
      "minuto","hora","mes","semana","domingo","lunes","martes",
      "miercoles","miércoles","jueves","viernes","sabado","sábado",
      "mediodia","mediodía","todavia","todavía","siempre","rapido","rápido",
      "despacio","temprano","tarde","cerca","derecha","izquierda",
      "importante","limpio","argentina","america","buenos","buenosaires","corrientes","cordoba"
    ];
    if (archivosUnaPalabra.includes(palabra)) {
      // normalizaciones rápidas
      const normalizaciones = {
        'manana':'Mañana','mañana':'Mañana','miercoles':'Miércoles','miércoles':'Miércoles',
        'sabado':'Sabado','sábado':'Sabado','mediodía':'Mediodía','mediodia':'Mediodía',
        'todavía':'Todavía','todavia':'Todavía','rapido':'Rápido','rápido':'Rápido',
        'buenos':'Buenos Aires','buenosaires':'Buenos Aires','cordoba':'Córdoba','corrientes':'Corrientes',
        'argentina':'Argentina','america':'América','america':'América'
      };
      const nombre = normalizaciones[palabra] || palabra;
      videosAReproducir.push(`Palabras/${nombre}.mp4`);
      continue;
    }

    // 6) variantes de anteayer
    if (palabra === 'anteayer' || palabra === 'antayer') {
      videosAReproducir.push('Palabras/Anteayer.mp4');
      continue;
    }

    // 7) fallback: no coincidio -> podemos registrar para debug
    // console.log('Sin mapeo para:', palabra);
  }

  // reproducir en cadena
  reproducirSecuencialmente(videosAReproducir);
}

// ==========================================================
// ==============  Reproducción secuencial  =================
// ==========================================================

let currentSpeed = (() => {
  const sc = document.getElementById("speedControl");
  const val = sc ? parseFloat(sc.value) : NaN;
  return Number.isFinite(val) ? val : 0.75;
})();

function reproducirSecuencialmente(lista) {
  if (!lista || lista.length === 0) {
    videoSeña.style.display = "none";
    return;
  }

  const path = lista.shift();

  // asegurar formato de ruta
  const ruta = path.toLowerCase().startsWith('palabras/') ? path : `Palabras/${path.replace(/^Palabras\//i,'')}`;

  // asignar la fuente y preparar reproducción
  videoSource.src = ruta;
  // forzar muting durante autoplay (mejora reproducción automática en navegadores)
  videoSeña.muted = true;
  videoSeña.load();
  videoSeña.style.display = "block";
  videoSeña.playbackRate = currentSpeed;

  // intentar reproducir y atrapar promesas
  const playPromise = videoSeña.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      // si todo ok, dejamos muted por si querés habilitar sonido luego
      // descomentar siguiente línea si querés sonido automáticamente (puede fallar por políticas)
      // videoSeña.muted = false;
    }).catch((err) => {
      // Si no puede reproducir automaticamente (bloqueo del navegador), mostramos mensaje de instrucción
      console.warn('No se pudo reproducir automáticamente el video. Pide al usuario que haga click en el reproductor. Error:', err);
      // Dejamos el video visible para que usuario haga click manualmente
    });
  }

  videoSeña.onended = () => {
    setTimeout(() => {
      reproducirSecuencialmente(lista);
    }, 100); // delay 100ms
  };
}

// ==========================================================
// =====================  Extras UI  ========================
// ==========================================================

// Control de velocidad
const speedControl = document.getElementById("speedControl");
const speedValue = document.getElementById("speedValue");

if (speedValue && speedControl) {
  speedValue.textContent = parseFloat(speedControl.value) + "x";
  speedControl.addEventListener("input", () => {
    currentSpeed = parseFloat(speedControl.value);
    videoSeña.playbackRate = currentSpeed;
    speedValue.textContent = currentSpeed + "x";
  });
}

// Indicador de micrófono
function activarMicrofono() {
  boton.classList.add("mic-active");
}
function desactivarMicrofono() {
  boton.classList.remove("mic-active");
}

// Glow en el texto cuando hay input
function mostrarTextoReconocido(textoReconocido) {
  texto.textContent = textoReconocido;
  texto.classList.add("glow");
  setTimeout(() => texto.classList.remove("glow"), 1000);
}

// Toggle alto contraste
const contrastToggle = document.getElementById("contrastToggle");
if (contrastToggle) {
  contrastToggle.addEventListener("click", () => {
    document.body.classList.toggle("high-contrast");
  });
}
