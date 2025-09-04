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

// Ocultar el video al cargar la página
videoSeña.style.display = "none";

// Configuramos el reconocimiento de voz
const reconocimiento = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
reconocimiento.lang = 'es-ES'; // Idioma español

boton.addEventListener('click', () => {
    activarMicrofono();                    // Enciende indicador
    if (startText) startText.textContent = "Escuchando..."; // Cambia texto del botón
    reconocimiento.start();                // Inicia el reconocimiento de voz
});

reconocimiento.onresult = (event) => {
    const speechText = event.results[0][0].transcript.toLowerCase();
    mostrarTextoReconocido(speechText);
    procesarTextoSecuencial(speechText);
};

// Apaga el indicador cuando finaliza el reconocimiento
reconocimiento.onend = () => {
    desactivarMicrofono();
    if (startText) startText.textContent = "Hablar"; // Restaura texto del botón
};

entradaTexto.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        const userInput = entradaTexto.value.toLowerCase();
        mostrarTextoReconocido(userInput);
        procesarTextoSecuencial(userInput);
    }
});

// ==========================================================
// ===============  Conjugaciones por verbo  =================
// (mantenemos el mismo formato que ya usabas)
// ==========================================================
const conjugaciones = {
    dialogar: [
        "dialogar", "dialogo", "dialogás", "dialogas", "dialoga", "dialogamos", "dialogan",
        "dialogué", "dialogaste", "dialogó", "dialogamos", "dialogaron",
        "dialogaba", "dialogabas", "dialogábamos", "dialogaban",
        "dialogaré", "dialogarás", "dialogará", "dialogaremos", "dialogarán",
        "dialogaría", "dialogarías", "dialogaríamos", "dialogarían",
        "dialogando", "dialogado", "he dialogado", "hemos dialogado", "han dialogado"
    ],
    hablar: [
        "hablar", "hablo", "hablás", "hablas", "habla", "hablamos", "hablan",
        "hablé", "hablaste", "habló", "hablamos", "hablaron",
        "hablaba", "hablabas", "hablábamos", "hablaban",
        "hablaré", "hablarás", "hablará", "hablaremos", "hablarán",
        "hablaría", "hablarías", "hablaríamos", "hablarían",
        "hablando", "hablado", "he hablado", "hemos hablado", "han hablado"
    ],
    decir: [
        "decir", "digo", "decís", "dices", "dice", "decimos", "dicen",
        "dije", "dijiste", "dijo", "dijimos", "dijeron",
        "decía", "decías", "decíamos", "decían",
        "diré", "dirás", "dirá", "diremos", "dirán",
        "diría", "dirías", "diríamos", "dirían",
        "diciendo", "dicho", "he dicho", "hemos dicho", "han dicho"
    ],
    contar: [
        "contar", "cuento", "contás", "contas", "cuenta", "contamos", "cuentan",
        "conté", "contaste", "contó", "contamos", "contaron",
        "contaba", "contabas", "contábamos", "contaban",
        "contaré", "contarás", "contará", "contaremos", "contarán",
        "contaría", "contarías", "contaríamos", "contarían",
        "contando", "contado", "he contado", "hemos contado", "han contado"
    ],
    narrar: [
        "narrar", "narro", "narrás", "narras", "narra", "narramos", "narran",
        "narré", "narraste", "narró", "narramos", "narraron",
        "narraba", "narrabas", "narrábamos", "narraban",
        "narraré", "narrarás", "narrará", "narraremos", "narrarán",
        "narrando", "narrado", "he narrado", "hemos narrado", "han narrado"
    ],
    explicar: [
        "explicar", "explico", "explicás", "explicas", "explica", "explicamos", "explican",
        "expliqué", "explicaste", "explicó", "explicamos", "explicaron",
        "explicaba", "explicabas", "explicábamos", "explicaban",
        "explicaré", "explicarás", "explicará", "explicaremos", "explicarán",
        "explicando", "explicado", "he explicado", "hemos explicado", "han explicado"
    ],
    estar: [
        "estar", "estoy", "estás", "está", "estamos", "están",
        "estuve", "estuviste", "estuvo", "estuvimos", "estuvieron",
        "estaba", "estabas", "estábamos", "estaban",
        "estaré", "estarás", "estará", "estaremos", "estarán",
        "estando", "estado", "he estado", "hemos estado", "han estado"
    ],

    // ===== Verbos nuevos detectados en tu carpeta =====
    apurar: [
        "apurar", "apuro", "apurás", "apuras", "apura", "apuramos", "apuran",
        "apuré", "apuraste", "apuró", "apuramos", "apuraron",
        "apuraba", "apurabas", "apurábamos", "apuraban",
        "apuraré", "apurarás", "apurará", "apuraremos", "apurarán",
        "apuraría", "apurarías", "apuraríamos", "apurarían",
        "apurando", "apurado", "he apurado", "hemos apurado", "han apurado"
    ],
    llegar: [
        "llegar", "llego", "llegás", "llegas", "llega", "llegamos", "llegan",
        "llegué", "llegaste", "llegó", "llegamos", "llegaron",
        "llegaba", "llegabas", "llegábamos", "llegaban",
        "llegaré", "llegarás", "llegará", "llegaremos", "llegarán",
        "llegaría", "llegarías", "llegaríamos", "llegarían",
        "llegando", "llegado", "he llegado", "hemos llegado", "han llegado"
    ]
};

// ==========================================================
// ==================  Palabras fijas  =======================
// (incluye nuevas de la carpeta; se agregan variantes sin tilde)
// ==========================================================
const palabrasFijas = {
    // Ya existentes
    "lengua oral": "Lengua oral",
    si: "Si", "sí": "Si",
    no: "No",
    negar: "Negar",
    también: "Tambien", "tambien": "Tambien",
    tampoco: "Tampoco",
    yo: "Yo",
    vos: "Vos",
    ustedes: "Ustedes",
    "el": "El o Ella",
    "ella": "El o Ella",
    "nosotros": "Nosotros o Nosotras",
    "nosotras": "Nosotros o Nosotras",

    // ===== Nuevas palabras/expresiones (según tu carpeta) =====
    // Tiempo / frecuencia
    "ayer": "ayer",
    "hoy": "hoy",
    "mañana": "mañana", "manana": "mañana",
    "año": "año", "ano": "año",
    "año pasado": "año pasado", "ano pasado": "año pasado",
    "futuro": "futuro",
    "pasado": "pasado",
    "último": "ultimo", "ultimo": "ultimo",
    "minuto": "minuto",
    "hora": "hora",
    "mes": "mes",
    "semana": "semana",
    "domingo": "domingo",
    "lunes": "lunes",
    "martes": "martes",
    "miércoles": "miercoles", "miercoles": "miercoles",
    "jueves": "jueves",
    "viernes": "viernes",
    "sábado": "sabado", "sabado": "sabado",
    "mediodía": "mediodia", "mediodia": "mediodia",
    "todavía": "todavia", "todavia": "todavia",
    "siempre": "siempre",
    "rápido": "rapido", "rapido": "rapido",
    "despacio": "despacio",
    "temprano": "temprano",
    "tarde": "tarde",
    "hasta": "hasta",

    // Lugar / direcciones / cualidades
    "cerca": "cerca",
    "derecha": "derecha",
    "izquierda": "izquierda",
    "importante": "importante",
    "limpio": "limpio",

    // Días y frases sociales
    "hola": "hola",
    "no": "No",
    "si": "Si", "sí": "Si",

    // ¡Ojo! Las frases multi-palabra se manejan abajo con includes(),
    // pero igual ponemos aquí las formas de UNA palabra para que
    // funcionen si vienen sueltas.
};

// ==========================================================
// =========  Procesamiento secuencial (con frases) =========
// ==========================================================
function procesarTextoSecuencial(text) {
    const palabras = text.split(" ");
    const videosAReproducir = [];

    // ---- Frases fijas (multi-palabra) ----
    // Mantengo tus existentes y agrego las nuevas vistas en la carpeta
    if (text.includes("como estas") || text.includes("cómo estás")) {
        videosAReproducir.push("Palabras/comoestas.mp4");
    }
    if (text.includes("vos cómo te llamas") || text.includes("cómo te llamas")) {
        videosAReproducir.push("Palabras/comotellamas.mp4");
    }
    if (text.includes("me llamo luana")) {
        videosAReproducir.push("Palabras/llamoluana.mp4");
    }
    // Nuevas:
    if (text.includes("como quieres") || text.includes("cómo quieres")) {
        videosAReproducir.push("Palabras/como quieres.mp4");
    }
    if (text.includes("lo siento")) {
        videosAReproducir.push("Palabras/lo siento.mp4");
    }
    if (text.includes("hace poco")) {
        videosAReproducir.push("Palabras/hace poco.mp4");
    }
    if (text.includes("a veces")) {
        videosAReproducir.push("Palabras/a veces.mp4");
    }
    if (text.includes("toda la noche")) {
        videosAReproducir.push("Palabras/toda la noche.mp4");
    }
    if (text.includes("todos los dias") || text.includes("todos los días")) {
        videosAReproducir.push("Palabras/todos los dias.mp4");
    }
    if (text.includes("primera vez")) {
        videosAReproducir.push("Palabras/primera vez.mp4");
    }
    if (text.includes("año pasado") || text.includes("ano pasado")) {
        videosAReproducir.push("Palabras/año pasado.mp4");
    }

    // ---- Palabras individuales ----
    for (let palabra of palabras) {
        palabra = palabra.trim();

        // Saludos simples
        if (palabra === "hola") {
            videosAReproducir.push("Palabras/hola.mp4");
            continue;
        }

        // Letras
        const letras = ["a","b","c","d","e","f","g","h","i","j","k","l","ll","m","n","ñ","o","p","q","r","s","t","u","v","w","x","y","z","ch"];
        if (letras.includes(palabra)) {
            videosAReproducir.push(`Palabras/letra${palabra.toUpperCase()}.mp4`);
            continue;
        }

        // Verbo conjugado
        for (let verbo in conjugaciones) {
            if (conjugaciones[verbo].includes(palabra)) {
                const nombreArchivo = (verbo === "contar" || verbo === "narrar")
                    ? "Contar o Narrar"
                    : verbo.charAt(0).toUpperCase() + verbo.slice(1);
                videosAReproducir.push(`Palabras/${nombreArchivo}.mp4`);
                break;
            }
        }

        // Palabras fijas sueltas (una sola palabra)
        for (let fija in palabrasFijas) {
            if (palabra === fija) {
                videosAReproducir.push(`Palabras/${palabrasFijas[fija]}.mp4`);
                break;
            }
        }

        // Casos de una sola palabra que están como archivo exacto:
        // (por si vienen así en el texto y no entran en 'palabrasFijas')
        const archivosUnaPalabra = [
            "ayer","hoy","mañana","manana","futuro","pasado","ultimo","último",
            "minuto","hora","mes","semana","domingo","lunes","martes",
            "miercoles","miércoles","jueves","viernes","sabado","sábado",
            "mediodia","mediodía","todavia","todavía","siempre","rapido","rápido",
            "despacio","temprano","tarde","cerca","derecha","izquierda",
            "importante","limpio"
        ];
        if (archivosUnaPalabra.includes(palabra)) {
            // Normalizamos a los nombres de archivo que vi en tu carpeta
            const normalizaciones = {
                "manana":"mañana", "miercoles":"miercoles", "miércoles":"miercoles",
                "sabado":"sabado", "sábado":"sabado",
                "mediodía":"mediodia", "todavía":"todavia",
                "rápido":"rapido", "último":"ultimo"
            };
            const nombre = normalizaciones[palabra] || palabra;
            videosAReproducir.push(`Palabras/${nombre}.mp4`);
            continue;
        }

        // Variantes de "anteayer"
        if (palabra === "anteayer" || palabra === "antayer") {
            videosAReproducir.push("Palabras/antayer.mp4"); // según tu captura
            continue;
        }
    }

    reproducirSecuencialmente(videosAReproducir);
}

// ==========================================================
// ==============  Reproducción secuencial  =================
// ==========================================================

// ====== Velocidad global (fix) ======
let currentSpeed = (() => {
  const sc = document.getElementById("speedControl");
  const val = sc ? parseFloat(sc.value) : NaN;
  return Number.isFinite(val) ? val : 0.75;
})();

function reproducirSecuencialmente(lista) {
    if (lista.length === 0) {
        videoSeña.style.display = "none";
        return;
    }

    const path = lista.shift();
    videoSource.src = path;
    videoSeña.load();
    videoSeña.style.display = "block";

    // ✅ Usar la velocidad actual elegida por el usuario (no pisar con 0.75)
    videoSeña.playbackRate = currentSpeed;

    videoSeña.onended = () => {
        setTimeout(() => {
            reproducirSecuencialmente(lista);
        }, 100); // delay de 100ms
    };
    videoSeña.play();
}

// ==========================================================
// =====================  Extras UI  ========================
// ==========================================================

// 🎚 Control de velocidad
const speedControl = document.getElementById("speedControl");
const speedValue = document.getElementById("speedValue");

// Sincronizar la etiqueta al cargar
if (speedValue && speedControl) {
  speedValue.textContent = parseFloat(speedControl.value) + "x";
}

speedControl.addEventListener("input", () => {
  currentSpeed = parseFloat(speedControl.value);   // actualizar velocidad global
  videoSeña.playbackRate = currentSpeed;           // aplicar de inmediato si está reproduciendo
  speedValue.textContent = currentSpeed + "x";
});

// 🎤 Indicador de micrófono
function activarMicrofono() {
  boton.classList.add("mic-active");
}
function desactivarMicrofono() {
  boton.classList.remove("mic-active");
}

// ✨ Glow en el texto cuando hay input
function mostrarTextoReconocido(textoReconocido) {
  texto.textContent = textoReconocido;
  texto.classList.add("glow");
  setTimeout(() => texto.classList.remove("glow"), 1000);
}

// ♿ Toggle de alto contraste
const contrastToggle = document.getElementById("contrastToggle");
contrastToggle.addEventListener("click", () => {
  document.body.classList.toggle("high-contrast");
});
