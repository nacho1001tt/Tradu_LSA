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

// Configuramos reconocimiento de voz (si disponible)
const Recon = window.SpeechRecognition || window.webkitSpeechRecognition;
const reconocimiento = Recon ? new Recon() : null;
if (reconocimiento) reconocimiento.lang = 'es-ES';

// -------------------------- Utilidades --------------------------

// Normaliza: minusculas, elimina diacríticos, quita signos de puntuación extremos
function normalizar(text) {
  if (!text) return '';
  // pasar a minusculas, normalizar tilde, quitar caracteres especiales básicos
  let t = String(text).toLowerCase().trim();
  t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // quita tildes
  // reemplazar signos de interrogación/exclamación por espacio para separar
  t = t.replace(/[¿?¡!,.]/g, '');
  // colapsar múltiples espacios
  t = t.replace(/\s+/g, ' ');
  return t;
}

// Quitar espacios para generar keys compactas
function keyCompact(text) {
  return normalizar(text).replace(/\s+/g, '');
}

// Generador de conjugaciones regulares (forma amplia)
function generarConjugacionesRegulares(infinitivo) {
  const set = new Set();
  if (!infinitivo) return [];
  const inf = normalizar(infinitivo);
  set.add(inf);

  const raiz = inf.slice(0, -2);
  const term = inf.slice(-2);

  if (!['ar', 'er', 'ir'].includes(term)) {
    // fallback: añadir la forma base
    set.add(inf);
    return Array.from(set);
  }

  // Presente indicativo
  const pres = {
    ar: ['o','as','a','amos','an'],
    er: ['o','es','e','emos','en'],
    ir: ['o','es','e','imos','en']
  }[term];

  pres.forEach((s, i) => set.add(raiz + s));

  // Pretérito perfecto simple (regularizaciones)
  const pret = {
    ar: ['e','aste','o','amos','aron'],
    er: ['i','iste','io','imos','ieron'],
    ir: ['i','iste','io','imos','ieron']
  }[term];
  pret.forEach(s => set.add(raiz + s.replace('io','ó'))); // ajusta acento a ó para primera generación (no exacto para todos)

  // Formas correctas de pretérito (agregamos formas comunes explicitamente)
  if (term === 'ar') {
    set.add(raiz + 'é');
    set.add(raiz + 'aste');
    set.add(raiz + 'ó');
    set.add(raiz + 'amos');
    set.add(raiz + 'aron');
  } else {
    set.add(raiz + 'í');
    set.add(raiz + 'iste');
    set.add(raiz + 'ió');
    set.add(raiz + 'imos');
    set.add(raiz + 'ieron');
  }

  // Imperfecto
  if (term === 'ar') {
    ['aba','abas','aba','ábamos','aban'].forEach(s => set.add(raiz + s));
  } else {
    ['ía','ías','ía','íamos','ían'].forEach(s => set.add(raiz + s));
  }

  // Futuro simple (infinitivo + terminaciones)
  ['é','ás','á','emos','án'].forEach(s => set.add(inf + s));

  // Condicional
  ['ía','ías','ía','íamos','ían'].forEach(s => set.add(inf + s));

  // Gerundio y participio
  if (term === 'ar') set.add(raiz + 'ando');
  else set.add(raiz + 'iendo');

  if (term === 'ar') set.add(raiz + 'ado');
  else set.add(raiz + 'ido');

  // Compuestos comunes con haber
  ['he','has','ha','hemos','han'].forEach(aux => {
    const part = (term === 'ar') ? raiz + 'ado' : raiz + 'ido';
    set.add(`${aux} ${part}`);
  });

  // Variantes sin tilde (ya normalizadas) — set ya guarda todo en minúsculas y normalizado
  return Array.from(set);
}

// Inserta en un array sin duplicados añadiendo además la forma sin tilde
function mergeFormas(target, formas) {
  formas.forEach(f => {
    if (!f) return;
    const nf = normalizar(String(f));
    if (!target.includes(nf)) target.push(nf);
    const compact = nf.replace(/\s+/g, '');
    if (!target.includes(compact)) target.push(compact);
  });
}

// ---------------------------------------------------------------

// ---------------------- Conjugaciones --------------------------
// Mantendremos un objeto donde cada verbo clave tiene todas sus formas
const conjugaciones = {};

// Lista explícita de verbos que queremos expandir automáticamente
const verbosRegulares = [
  'amar','querer','sentir','odiar','ahorrar','cantar','bailar',
  'hablar','decir','contar','narrar','explicar','estar','apurar','llegar',
  'trabajar','practicar','comprar','vender','pagar','grabar','ganar',
  'vestir','desvestir','desnudar','desnudarse','jugar','dibujar'
];

// Genero conjugaciones para cada uno (si ya hay, se fusiona)
verbosRegulares.forEach(v => {
  const formas = generarConjugacionesRegulares(v);
  conjugaciones[v] = conjugaciones[v] || [];
  mergeFormas(conjugaciones[v], formas);
});

// Verbos irregulares o formas que conviene asegurar manualmente:
mergeFormas(conjugaciones['decir'] ||= [], [
  'decir','digo','dices','dice','decimos','dicen',
  'dije','dijiste','dijo','dijimos','dijeron',
  'decía','decías','decíamos','decían',
  'diré','dirás','dirá','diremos','dirán',
  'diría','dirías','diríamos','dirían',
  'diciendo','dicho','he dicho','has dicho','ha dicho','hemos dicho','han dicho'
]);

mergeFormas(conjugaciones['estar'] ||= [], [
  'estar','estoy','estas','está','estamos','estan',
  'estuve','estuviste','estuvo','estuvimos','estuvieron',
  'estaba','estabas','estabamos','estaban',
  'estare','estarás','estará','estaremos','estarán',
  'estando','estado','he estado','has estado','ha estado','hemos estado','han estado'
]);

// Aseguramos que algunos verbos pedidos tengan formas compuestas también
['amar','querer','sentir','odiar','ahorrar','cantar','bailar'].forEach(v => {
  conjugaciones[v] = conjugaciones[v] || [];
  mergeFormas(conjugaciones[v], generarConjugacionesRegulares(v));
  // añadimos explícitos compuestos con haber por si algo faltó
  ['he','has','ha','hemos','han'].forEach(aux => {
    const part = (v.endsWith('ar') ? v.slice(0, -2) + 'ado' : v.slice(0, -2) + 'ido');
    mergeFormas(conjugaciones[v], [`${aux} ${part}`]);
  });
});

// ---------------------------------------------------------------

// ---------------------- Mapeo de archivos ----------------------
// Lista de archivos que mencionaste (nombres exactos de los .mp4)
// Para robustez generamos mapeos de claves (con y sin espacios, sin tildes)
const archivosLista = [
  "A Veces","Abuelo Abuela","Administración","Administrar","Admirar O Admiración",
  "Ahorrar","Ahorro","Amar O Querer","Amor O Enamorado","América","Anteayer",
  "Antártida O Antártida Argentina","Apurar","Argentina","Ayer","Año Pasado","Año",
  "Bailar","Barato","Bebé","Bombero Bombera","Buenos Aires","Camiseta","Cantar",
  "Caro","Catamarca","Católico Católica","Cerca","Chaco","Chubut","Como Estas",
  "Como Quieras","Comoestas","Comotellamas","Comprar","Computadora","Confiar O Confianza",
  "Contar O Narrar","Corrientes","Córdoba","Deber","Decir","Derecha","Desconfiar O Desconfianza",
  "Deseo O Desear","Desnudar","Desnudarse","Despacio","Después","Desvestir","Desvestirse",
  "Deuda","Dialogar","Dibujar","Documento","Domingo","Echar O Despedir","Economía",
  "Edad O Cumpleaños","El o Ella","Emoción O Emocionarse O Emocionarse","Empleado Empleada",
  "Enfermero Enfermera","Enseguida","Entre Ríos","Esposo Esposa","Estafa","Estafar",
  "Estar","Europa","Explicar","Extranjero Extranjera","Feriado O Fiesta","Formosa","Futuro",
  "Fútbol","Ganancia","Ganar","Grabar","Gratis","Hablar","Hace Poco","Hasta","Hermano Hermana",
  "Hijo Hija","Hora","Hoy","Iglesia","Importante","Internacional","Izquierda","Jamás",
  "Jefe Jefa","Jesús Jesucristo","Jubilado Jubilada","Jueves","Jugar","Jujuy","La Pampa",
  "La Rioja","Lengua Oral","Limpio","Llegar","Lo Siento","Lunes","Madrastra Madrastras",
  "Malvinas","Mamá Madre Madres","Martes","Mañana","Mediodía","Mendoza","Mes","Minuto",
  "Misiones","Miércoles","Médico O Doctor","Música","Nacional","Negar","Negociar",
  "Negocio","Neuquén","Nieto Nieta","No","Nosotros o Nosotras","Novio Novia","Odio O Odiar",
  "Ofender O Ofendido O Ofensa","Padrastro Padrastros","Pagar","Papá Padre Padres","Pareja",
  "Pasado","Patagonia","Persona","Personalidad","Personas O Gente","Poder","Policía",
  "Política","Practicar","Presidente","Primeravez","Primo Prima","Profesional O Profesión",
  "Provincia","Pulover","Remera","Renunciar","Representante","Rio Negro","Ropa","Ruido",
  "Rápido","Sabado","Salta","San Juan","San Luis","Santa Cruz","Santa Fe","Santiago Del Estero",
  "Semana","Sentir O Sentimiento","Separado Separada","Señora","Si","Siempre","Sobrino Sobrina",
  "Sobrinos Sobrinas","Soltero Soltera","Sueldo","Tambien","Tampoco","Tarde","Temprano",
  "Tiempo","Tierra Del Fuego","Tio Tia","Todalanoche","Todavía","Todoslosdias","Trabajar",
  "Trabajo","Tucumán","Ustedes","Vender","Vestir","Viernes","Viudo Viuda","Vos","Yo",
  "Zapatilla","Zapato","hola","letraA","letraB","letraC","letraCH","letraD","letraE","letraF",
  "letraG","letraH","letraI","letraJ","letraK","letraL","letraLL","letraM","letraN","letraO",
  "letraP","letraQ","letraR","letraS","letraT","letraU","letraV","letraW","letraX","letraY",
  "letraZ","letraÑ","llamoluana","Último"
];

// Construyo un objeto de mapeo robusto: claves normalizadas -> filename (sin extensión)
const palabrasFijas = {};
archivosLista.forEach(filename => {
  const fileKey = filename; // nombre tal cual
  const fileNoSpace = filename.replace(/\s+/g,''); // sin espacios
  const fileNorm = normalizar(filename); // con tildes eliminadas y minusculas
  const fileNormNoSpace = fileNorm.replace(/\s+/g,'');
  // Mapear varias claves posibles a la misma entrada
  palabrasFijas[fileNorm] = filename;
  palabrasFijas[fileNormNoSpace] = filename;
  palabrasFijas[fileNoSpace.toLowerCase()] = filename;
  palabrasFijas[fileKey.toLowerCase()] = filename;
});

// Añadimos mapeos específicos (casos donde querías tux y variantes)
const extras = {
  'entrerios':'Entre Ríos',
  'lapampa':'La Pampa',
  'larioja':'La Rioja',
  'rionegro':'Rio Negro',
  'sanjuan':'San Juan',
  'sanluis':'San Luis',
  'santacruz':'Santa Cruz',
  'santafe':'Santa Fe',
  'santiagodelestero':'Santiago Del Estero',
  'antartidaargentina':'Antártida O Antártida Argentina',
  'tierradelfuego':'Tierra Del Fuego',
  'hijohija':'Hijo Hija',
  'bebe':'Bebé',
  'abueloabuela':'Abuelo Abuela',
  'hermanohermana':'Hermano Hermana',
  'tiotia':'Tio Tia',
  'padrastro':'Padrastro Padrastros',
  'madrastra':'Madrastra Madrastras',
  'esposoesposa':'Esposo Esposa',
  'pareja':'Pareja',
  'solterosoltera':'Soltero Soltera',
  'separadoseparada':'Separado Separada',
  'edad':'Edad O Cumpleaños',
  'cumpleanos':'Edad O Cumpleaños',
  'extranjeroextranjera':'Extranjero Extranjera',
  'catolicocatolica':'Católico Católica',
  'jesus':'Jesús Jesucristo',
  'jesucristo':'Jesús Jesucristo',
  'iglesia':'Iglesia',
  'administrar':'Administrar',
  'negociar':'Negociar',
  'estafa':'Estafa',
  'estafar':'Estafar',
  'ahorro':'Ahorro',
  'ahorrar':'Ahorrar',
  'deber':'Deber',
  'barato':'Barato',
  'caro':'Caro',
  'jefejefa':'Jefe Jefa',
  'empleadoempleada':'Empleado Empleada',
  'jubiladojubilada':'Jubilado Jubilada',
  'sueldo':'Sueldo',
  'echar':'Echar O Despedir',
  'despedir':'Echar O Despedir',
  'renunciar':'Renunciar',
  'feriado':'Feriado O Fiesta',
  'fiesta':'Feriado O Fiesta',
  'bomberobombera':'Bombero Bombera',
  'enfermeroenfermera':'Enfermero Enfermera',
  'nacional':'Nacional',
  'nacionalmente':'Nacional',
  'internacional':'Internacional',
  'internacionalmente':'Internacional',
  'poder':'Poder',
  'compu':'Computadora',
  'computadora':'Computadora',
  'jugar':'Jugar',
  'dibujar':'Dibujar',
  'ruido':'Ruido',
  'cantar':'Cantar',
  'bailar':'Bailar',
  'persona':'Persona',
  'personas':'Personas O Gente',
  'gente':'Personas O Gente',
  'personalidad':'Personalidad',
  'amar':'Amar O Querer',
  'querer':'Amar O Querer',
  'sentir':'Sentir O Sentimiento',
  'sentimiento':'Sentir O Sentimiento',
  'odio':'Odio O Odiar',
  'odiar':'Odio O Odiar',
  'emocion':'Emoción O Emocionarse O Emocionarse',
  'emocionado':'Emoción O Emocionarse O Emocionarse',
  'emocionarse':'Emoción O Emocionarse O Emocionarse',
  'confiar':'Confiar O Confianza',
  'confianza':'Confiar O Confianza',
  'desconfiar':'Desconfiar O Desconfianza',
  'desconfianza':'Desconfiar O Desconfianza',
  'deseo':'Deseo O Desear',
  'desear':'Deseo O Desear',
  'admirar':'Admirar O Admiración',
  'admiracion':'Admirar O Admiración',
  'ofender':'Ofender O Ofendido O Ofensa',
  'ofensa':'Ofender O Ofendido O Ofensa',
  'ofendido':'Ofender O Ofendido O Ofensa',
  // letras (aseguro claves "a", "b", etc. mapeadas a letraX)
  'a':'letraA','b':'letraB','c':'letraC','d':'letraD','e':'letraE','f':'letraF','g':'letraG',
  'h':'letraH','i':'letraI','j':'letraJ','k':'letraK','l':'letraL','m':'letraM','n':'letraN',
  'ñ':'letraÑ','o':'letraO','p':'letraP','q':'letraQ','r':'letraR','s':'letraS','t':'letraT',
  'u':'letraU','v':'letraV','w':'letraW','x':'letraX','y':'letraY','z':'letraZ','ch':'letraCH','ll':'letraLL'
};

Object.keys(extras).forEach(k => {
  palabrasFijas[k] = extras[k];
});

// Añadimos formas comunes sin tildes / compactas para los archivos ya en palabrasFijas
Object.keys({...palabrasFijas}).forEach(k => {
  const v = palabrasFijas[k];
  const noSpaces = k.replace(/\s+/g,'');
  palabrasFijas[noSpaces] = v;
});

// ------------------ FIN Mapeo de archivos --------------------

// ------------------- Procesamiento principal ------------------

// Ordena frases por índice de aparición (resolviendo prioridad según su ubicacion en la frase)
function obtenerFrasesEnOrden(text, frasesMap) {
  const matches = [];
  const t = text;
  Object.keys(frasesMap).forEach(phraseKey => {
    // phraseKey ya normalizado (sin tilde y minúsculo)
    const idx = t.indexOf(phraseKey);
    if (idx !== -1) matches.push({idx, phraseKey});
  });
  matches.sort((a,b) => a.idx - b.idx);
  return matches.map(m => m.phraseKey);
}

// Preparo un mapa de frases multi-palabra prioritarias (normalizadas)
const frasesPrioritarias = {};
[
  "como estas","como estás","comoestas",
  "como quieres","como quieres?","comoquieres",
  "como te llamas","vos cómo te llamas","comotellamas",
  "me llamo luana","lo siento","hace poco","a veces","toda la noche","todos los dias","todos los días",
  "primera vez","año pasado","ano pasado"
].forEach(f => {
  frasesPrioritarias[normalizar(f)] = palabrasFijas[ keyCompact(f) ] || palabrasFijas[normalizar(f)] || palabrasFijas[f.replace(/\s+/g,'')];
});

// Función principal que procesa texto y arma la lista de videos a reproducir en orden
function procesarTextoSecuencial(text) {
  if (!text) {
    videoSeña.style.display = "none";
    return;
  }

  const orig = String(text);
  text = normalizar(text);
  const videosAReproducir = [];

  // 1) Detectar y agregar frases multi-palabra en el orden en que aparecen
  const frasesEnOrden = obtenerFrasesEnOrden(text, frasesPrioritarias);
  frasesEnOrden.forEach(phraseKey => {
    // obtener filename a partir del mapa palabrasFijas (fraseKey ya normalizado)
    const filename = palabrasFijas[phraseKey] || palabrasFijas[phraseKey.replace(/\s+/g,'')];
    if (filename) videosAReproducir.push(`Palabras/${filename}.mp4`);
  });

  // 2) Ahora procesar la entrada palabra por palabra manteniendo el orden original
  const palabras = text.split(/\s+/);
  for (let i = 0; i < palabras.length; i++) {
    let palabra = palabras[i];
    if (!palabra) continue;

    // si la palabra formó parte de una frase ya capturada, evitamos duplicarla
    // comprobamos si alguna de las frases priorizadas empieza en esta posición
    let skip = false;
    for (let phrase of frasesEnOrden) {
      // si la frase contiene la palabra exacta como palabra completa y aparece en la posición actual, la ignoramos
      const phraseWords = phrase.split(/\s+/);
      if (phraseWords.includes(palabra)) {
        // mejor comprobar índice por búsqueda en texto original a partir de i
        // (simplificando: evitamos duplicados si la frase contiene la palabra)
        skip = true;
        // pero no forzamos skip universal para no bloquear casos donde palabra aparece independiente
      }
    }
    // No hacemos skip automático (para evitar quitar palabras que aparecen también fuera de la frase)
    // En cambio, chequeamos si la frase ya ocupó el segmento: detectamos si la concatenación desde i coincide
    let consumedByPhrase = false;
    for (let phrase of frasesEnOrden) {
      const phraseCompact = phrase.replace(/\s+/g,'');
      // construimos segmento desde i con longitud de phraseWords
      const phraseWords = phrase.split(/\s+/);
      const seg = palabras.slice(i, i + phraseWords.length).join('');
      if (seg === phraseCompact) {
        consumedByPhrase = true;
        break;
      }
    }
    if (consumedByPhrase) {
      // saltamos las palabras que ya fueron incluidas por una frase
      // avanzar el índice en consecuencia
      // buscar la frase que coincide y avanzar
      for (let phrase of frasesEnOrden) {
        const phraseWords = phrase.split(/\s+/);
        const seg = palabras.slice(i, i + phraseWords.length).join('');
        if (seg === phrase.replace(/\s+/g,'')) {
          i += phraseWords.length - 1; // -1 porque el for incrementará
          consumedByPhrase = true;
          break;
        }
      }
      if (consumedByPhrase) continue;
    }

    // 2.a) saludos exactos
    if (palabra === 'hola') {
      videosAReproducir.push('Palabras/hola.mp4');
      continue;
    }

    // 2.b) letras (soportamos 'a' o 'letra a' o 'letraA')
    const letras = ["a","b","c","d","e","f","g","h","i","j","k","l","ll","m","n","ñ","o","p","q","r","s","t","u","v","w","x","y","z","ch"];
    if (letras.includes(palabra) || palabra.startsWith('letra')) {
      const cleaned = palabra.startsWith('letra') ? palabra.replace('letra','').trim() : palabra;
      const letraKey = cleaned.toUpperCase().replace(/\s+/g,'').replace('Ñ','Ñ');
      // construyo nombre conservando mayúscula seguida de minúscula que existe en tu carpeta
      const posible = letras.includes(cleaned) ? `letra${letraKey}` : `letra${letraKey}`;
      // buscar nombre en palabrasFijas
      const mapped = palabrasFijas[ normalizar(posible) ] || palabrasFijas[posible.toLowerCase()] || posible;
      videosAReproducir.push(`Palabras/${mapped}.mp4`);
      continue;
    }

    // 2.c) verbos: comprobar en el objeto conjugaciones
    let matched = false;
    for (let verbo in conjugaciones) {
      if (conjugaciones[verbo].includes(palabra)) {
        const nombreArchivo = (verbo === "contar" || verbo === "narrar") ? "Contar O Narrar" : (verbo.charAt(0).toUpperCase() + verbo.slice(1));
        videosAReproducir.push(`Palabras/${nombreArchivo}.mp4`);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // 2.d) palabras fijas mapeadas directamente
    const keyCompacto = palabra.replace(/\s+/g,'');
    const lookup = palabrasFijas[palabra] || palabrasFijas[keyCompacto] || palabrasFijas[ normalizar(palabra) ];
    if (lookup) {
      videosAReproducir.push(`Palabras/${lookup}.mp4`);
      continue;
    }

    // 2.e) fallback: intentar normalizaciones adicionales (sin tilde, sin espacios)
    const candidate = normalizar(palabra);
    if (palabrasFijas[candidate]) {
      videosAReproducir.push(`Palabras/${palabrasFijas[candidate]}.mp4`);
      continue;
    }
    const candidateNoSpace = candidate.replace(/\s+/g,'');
    if (palabrasFijas[candidateNoSpace]) {
      videosAReproducir.push(`Palabras/${palabrasFijas[candidateNoSpace]}.mp4`);
      continue;
    }

    // si no se mapeó, lo ignoramos (podés registrar para debug)
    // console.log('Sin mapeo para:', palabra);
  }

  // Finalmente reproducir en la secuencia obtenida (sin duplicados consecutivos)
  // Limpiar duplicados consecutivos exactos
  const cleanedList = [];
  for (let i=0;i<videosAReproducir.length;i++) {
    if (i===0 || videosAReproducir[i] !== videosAReproducir[i-1]) cleanedList.push(videosAReproducir[i]);
  }

  reproducirSecuencialmente(cleanedList);
}

// ------------------ Reproducción secuencial --------------------

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

  // asegurar formato: si path ya incluye Palabras/ lo respetamos, si no lo agregamos
  let ruta = path;
  if (!/^palabras\//i.test(path)) {
    // si el path viene como "Palabras/Name.mp4" lo respetamos; si viene como "Palabras/Name" agregamos .mp4
    if (!/\.mp4$/i.test(path)) {
      ruta = path; // asumimos viene como `Palabras/Name.mp4` o `Palabras/Name`
    }
  }

  // Si nos pasaron solo el nombre de archivo (sin carpeta), intentar localizar en mapa inverso
  if (!/^palabras\//i.test(ruta) && !/\.mp4$/i.test(ruta)) {
    // buscar en palabrasFijas values igual a ruta, si no usar ruta directo
    ruta = `Palabras/${ruta}.mp4`;
  } else if (!/\.mp4$/i.test(ruta)) {
    ruta = ruta.endsWith('/') ? ruta + '.mp4' : ruta + '.mp4';
  }

  // Asignar la fuente
  videoSource.src = ruta;
  videoSeña.muted = true; // para autoplay
  videoSeña.load();
  videoSeña.style.display = "block";
  videoSeña.playbackRate = currentSpeed;

  // Intentar reproducir (manejar promesa)
  const p = videoSeña.play();
  if (p !== undefined) {
    p.then(() => {
      // reproducción OK
    }).catch(err => {
      console.warn('No se pudo reproducir automáticamente el video. Hacé click en el reproductor para continuar.', err);
      // dejar video visible para que el usuario haga click
    });
  }

  videoSeña.onended = () => {
    setTimeout(() => {
      reproducirSecuencialmente(lista);
    }, 100); // delay 100ms
  };
}

// -------------------- UI extras y eventos ---------------------

// Reconocimiento de voz: eventos y botones
if (reconocimiento) {
  reconocimiento.onresult = (event) => {
    try {
      const speechText = (event.results[0][0].transcript || '').toLowerCase().trim();
      mostrarTextoReconocido(speechText);
      procesarTextoSecuencial(speechText);
    } catch (err) {
      console.error('Error al leer resultado:', err);
    }
  };
  reconocimiento.onstart = () => {
    activarMicrofono();
    if (startText) startText.textContent = 'Escuchando...';
  };
  reconocimiento.onend = () => {
    desactivarMicrofono();
    if (startText) startText.textContent = 'Hablar';
  };
}

// Botón iniciar
if (boton) {
  boton.addEventListener('click', () => {
    if (!reconocimiento) {
      alert('Reconocimiento de voz no disponible en este navegador. Usá la entrada por texto.');
      return;
    }
    try {
      reconocimiento.start();
    } catch (err) {
      console.error('No se pudo iniciar el reconocimiento:', err);
    }
  });
}

// Entrada por teclado (Enter)
if (entradaTexto) {
  entradaTexto.addEventListener('keypress', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const v = entradaTexto.value || '';
      mostrarTextoReconocido(v);
      procesarTextoSecuencial(v);
    }
  });
}

// Control de velocidad
const speedControl = document.getElementById("speedControl");
const speedValue = document.getElementById("speedValue");
if (speedValue && speedControl) {
  speedValue.textContent = parseFloat(speedControl.value) + 'x';
  speedControl.addEventListener('input', () => {
    currentSpeed = parseFloat(speedControl.value);
    videoSeña.playbackRate = currentSpeed;
    speedValue.textContent = currentSpeed + 'x';
  });
}

// Indicador de micrófono (añade/remueve clase)
function activarMicrofono() { boton.classList.add('mic-active'); }
function desactivarMicrofono() { boton.classList.remove('mic-active'); }

// Glow en el texto
function mostrarTextoReconocido(txt) {
  const t = String(txt || '');
  if (texto) {
    texto.textContent = t;
    texto.classList.add('glow');
    setTimeout(() => texto.classList.remove('glow'), 1000);
  }
}

// Toggle alto contraste (si existe botón)
const contrastToggle = document.getElementById('contrastToggle');
if (contrastToggle) {
  contrastToggle.addEventListener('click', () => {
    document.body.classList.toggle('high-contrast');
  });
}

// ---------------------------------------------------------------
// Fin del script
// ---------------------------------------------------------------



