// REEMPLAZA TUS IMPORTACIONES EN portalScript.js CON ESTO:
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref as dbRef, push, onValue, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
// =======================================================================
// CONFIGURACIÓN DE FIREBASE (Se mantiene igual)
// =======================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDRsS6YQ481KQadSk8gf9QtxVt_asnrDlc",
  authDomain: "juegos-cumple.firebaseapp.com",
  databaseURL: "https://juegos-cumple-default-rtdb.firebaseio.com", 
  projectId: "juegos-cumple",
  storageBucket: "juegos-cumple.firebasestorage.app", 
  messagingSenderId: "595312538655",
  appId: "1:595312538655:web:93220a84570ff7461fd12a",
  measurementId: "G-V1YXNZXVQR"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const storage = getStorage(app); 

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// =======================================================================
// VARIABLES GLOBALES DE ARQUITECTURA (NUEVO)
// =======================================================================
let EVENT_ID;
// ⭐️ CORRECCIÓN: 'dataRef' ya no es necesaria, creamos 'memoriesRef' directamente
let memoriesRef;

// =======================================================================
// FUNCIONES DE ARQUITECTURA (NUEVO)
// =======================================================================

/**
 * Obtiene el ID del evento desde el parámetro 'event' de la URL.
 * Si no existe, bloquea la aplicación.
 */
function getEventId() {
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get('event');
    if (!eventId) {
        document.body.innerHTML = `
            <div style="padding: 40px; text-align: center; font-family: sans-serif; color: #333;">
                <h1>Error: Evento no encontrado</h1>
                <p>Asegúrate de que el enlace (URL) que estás usando sea correcto.</p>
            </div>
        `;
        throw new Error('Event ID no especificado en la URL.');
    }
    return eventId;
}

/**
 * Carga la configuración (tema, features, status) desde Firebase
 * y la aplica a la página.
 * @param {string} eventId - El ID del evento actual.
 */
async function loadEventConfig(eventId) {
    const configRef = dbRef(database, `events/${eventId}/config`);
    let config = {};
    
    try {
        const snapshot = await get(configRef);
        if (snapshot.exists()) {
            config = snapshot.val();
        } else {
            console.warn("No se encontró configuración de 'super-admin'. Usando valores por defecto.");
        }
    } catch (error) {
        console.error("Error cargando configuración:", error);
        throw new Error("Error al cargar la configuración del evento.");
    }

    // --- 1. CHEQUEO DE EVENTO ACTIVO (¡IMPORTANTE!) ---
    if (!config.status || config.status.is_active === false) {
        document.body.innerHTML = `
            <div style="padding: 40px; text-align: center; font-family: sans-serif; color: #333;">
                <h1>Evento Finalizado</h1>
                <p>Este portal de recuerdos ya no se encuentra disponible.</p>
            </div>
        `;
        throw new Error("El evento está deshabilitado.");
    }

    // --- 2. APLICAR TEMA VISUAL ---
    if (config.theme) {
        const theme = config.theme;
        const styleTag = document.createElement('style');
        // Usa los valores de la DB o los valores por defecto de tu style.css
        styleTag.innerHTML = `
            :root {
                --bee-yellow: ${theme.color_primary || '#FFC107'};
                --bee-black: ${theme.color_text || '#212529'};
                --honey-gold: ${theme.color_secondary || '#FF9800'};
            }
            body {
                font-family: ${theme.font_family || "'Poppins', sans-serif"};
                ${theme.background_image_url ? 
                `background-image: url('${theme.background_image_url}') !important;
                 background-size: cover;
                 background-position: center;` 
                : ''}
            }
        `;
        document.head.appendChild(styleTag);
    }
    
    // --- 3. APLICAR FUNCIONALIDADES (Juegos) ---
    if (config.features && config.features.games_enabled === false) {
        // Si los juegos están deshabilitados, oculta el botón del menú de juegos
        const gamesMenuToggle = document.getElementById('menu-juegos-toggle');
        if (gamesMenuToggle) {
            // Oculta el botón y el div relativo que lo contiene
            const parentDiv = gamesMenuToggle.parentElement;
            if (parentDiv) parentDiv.style.display = 'none';
        }
    }
}


// =======================================================================
// FUNCIONES DE RECUPERACIÓN Y RENDERIZACIÓN DE RECUERDOS (Sin cambios)
// =======================================================================

function renderMemories(memories) {
    const memoriesList = document.getElementById('memories-list');
    if (!memoriesList) return;
    memoriesList.innerHTML = ''; 

    if (memories.length === 0) {
        memoriesList.innerHTML = `<p class="text-sm text-gray-500 italic p-2 text-center">¡Sé el primero en dejar un recuerdo!</p>`;
        return;
    }

    memories.forEach(memory => {
        const memoryItem = document.createElement('div');
        memoryItem.className = 'memory-item p-3 mb-3 border-b border-yellow-200 last:border-b-0'; 
        
        let mediaContent = '';
        const fileUrl = memory.fileUrl || memory.mediaUrl;
        const fileType = memory.fileType || memory.mediaType;

        if (fileUrl) {
            const isVideo = fileType && fileType.startsWith('video');
            if (isVideo) {
                mediaContent = `<video controls src="${fileUrl}" class="w-full h-auto max-h-48 object-cover rounded-lg shadow-md mt-2" preload="none" style="max-width: 100%;"></video>`;
            } else {
                mediaContent = `<img src="${fileUrl}" alt="Recuerdo de ${memory.name}" class="w-full h-auto max-h-48 object-cover rounded-lg shadow-md mt-2" loading="lazy" style="max-width: 100%;">`;
            }
        }
        
        const date = memory.timestamp ? new Date(memory.timestamp) : new Date();
        const formattedDate = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        memoryItem.innerHTML = `
            <div class="flex items-start justify-between">
                <p class="font-bold text-gray-800 text-sm"><span class="text-honey-gold">🐝</span> ${memory.name}</p>
                <p class="text-xs text-gray-500">${formattedDate}</p>
            </div>
            ${memory.message && memory.message.trim() ? `<p class="text-gray-600 mt-1 mb-2 text-sm">${memory.message}</p>` : ''}
            ${mediaContent}
        `;
        memoriesList.appendChild(memoryItem);
    });
}

function listenForMemories() {
    const memoriesList = document.getElementById('memories-list');
    if (!memoriesList || !memoriesRef) return; // Asegura que las referencias existan
    
    onValue(memoriesRef, (snapshot) => {
        const data = snapshot.val();
        const memories = [];
        if (data) {
            for (let key in data) {
                memories.push({ id: key, ...data[key] });
            }
            memories.sort((a, b) => b.timestamp - a.timestamp);
        }
        renderMemories(memories);
    }, (error) => {
        console.error("Error al escuchar los recuerdos:", error);
        memoriesList.innerHTML = '<p class="text-sm text-red-500 italic">Error al cargar los recuerdos.</p>';
    });
}

// =======================================================================
// --- NUEVO: FUNCIÓN DE INICIALIZACIÓN DEL PORTAL ---
// (Separa la lógica del DOM de la carga inicial)
// =======================================================================
function initializePortal() {
    // DECLARACIONES DEL DOM
    const form = document.getElementById('memory-form');
    const nameInput = document.getElementById('guest-name');
    const messageInput = document.getElementById('guest-message');
    const fileInputPhoto = document.getElementById('guest-file-photo'); 
    const fileInputVideo = document.getElementById('guest-file-video'); 
    const submitButton = document.getElementById('submit-memory-btn');
    const progressBarContainer = document.getElementById('upload-progress-bar-container');
    const progressBar = document.getElementById('upload-progress');
    const uploadStatus = document.getElementById('upload-status');
    const fileNameDisplay = document.getElementById('file-name-display');
    const menuToggleBtn = document.getElementById('menu-juegos-toggle');
    const juegosDropdown = document.getElementById('juegos-dropdown');
    const cerrarMenuBtn = document.getElementById('cerrar-menu');
    
    // --- ¡¡¡BUG CORREGIDO!!! ---
    // Actualiza los enlaces de los juegos para incluir el event_id
    document.querySelectorAll('a[href="player.html"]').forEach(a => a.href = `player.html?event=${EVENT_ID}`);
    document.querySelectorAll('a[href="memory.html"]').forEach(a => a.href = `memory.html?event=${EVENT_ID}`);
    document.querySelectorAll('a[href="hangman.html"]').forEach(a => a.href = `hangman.html?event=${EVENT_ID}`);
    // Actualiza también el enlace del trofeo (si existe)
    const rankingTrophy = document.getElementById('ranking-trophy-btn');
    if (rankingTrophy) {
        rankingTrophy.href = `ranking.html?event=${EVENT_ID}`;
    }

    // LÓGICA DEL MENÚ FLOTANTE
    if (juegosDropdown && juegosDropdown.style.display !== 'none') {
        juegosDropdown.classList.add('hidden-dropdown'); 
    }
    function toggleJuegosMenu() {
        if (juegosDropdown) {
            juegosDropdown.classList.toggle('hidden-dropdown');
        }
    }
    if (menuToggleBtn) {
        menuToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            toggleJuegosMenu();
        });
    }
    if (cerrarMenuBtn) {
        cerrarMenuBtn.addEventListener('click', toggleJuegosMenu);
    }
    document.addEventListener('click', (event) => {
        if (!juegosDropdown || juegosDropdown.classList.contains('hidden-dropdown')) return;
        const isClickInsideMenu = juegosDropdown.contains(event.target);
        const isClickOnToggle = menuToggleBtn && menuToggleBtn.contains(event.target);
        if (!isClickInsideMenu && !isClickOnToggle) {
            juegosDropdown.classList.add('hidden-dropdown');
        }
    });

    // LÓGICA DE ENVÍO DE MENSAJES
    if (fileInputPhoto) {
        fileInputPhoto.addEventListener('change', () => {
            fileNameDisplay.textContent = fileInputPhoto.files.length > 0 ? `Foto: ${fileInputPhoto.files[0].name}` : '';
            if (fileInputVideo) fileInputVideo.value = ''; 
        });
    }
    if (fileInputVideo) {
        fileInputVideo.addEventListener('change', () => {
            fileNameDisplay.textContent = fileInputVideo.files.length > 0 ? `Video: ${fileInputVideo.files[0].name}` : '';
            if (fileInputPhoto) fileInputPhoto.value = ''; 
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault(); // ¡Este es el "freno" que ahora funcionará!
            
            const name = nameInput.value.trim().substring(0, 30);
            const message = messageInput.value.trim();
            let file = (fileInputPhoto && fileInputPhoto.files.length > 0) ? fileInputPhoto.files[0] : ((fileInputVideo && fileInputVideo.files.length > 0) ? fileInputVideo.files[0] : null);
            
            if (!name || (!message && !file)) {
                alert('Por favor, ingresa tu nombre y un mensaje o un archivo.');
                return;
            }
            if (file && file.size > MAX_FILE_SIZE) {
                alert('El archivo es demasiado grande. Límite: 10MB.');
                return;
            }

            submitButton.disabled = true;

            try {
                let fileUrl = null; 
                let fileType = null; 

                if (file) {
                    progressBarContainer.classList.remove('hidden');
                    uploadStatus.textContent = 'Iniciando subida...';

                    const fileName = `${Date.now()}-${file.name}`;
                    // --- RUTA DE STORAGE ACTUALIZADA ---
                    const sRef = storageRef(storage, `events/${EVENT_ID}/memories/${fileName}`);
                    const uploadTask = uploadBytesResumable(sRef, file);

                    await new Promise((resolve, reject) => {
                        uploadTask.on('state_changed', 
                            (snapshot) => {
                                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                                progressBar.style.width = progress + '%';
                                uploadStatus.textContent = `Subiendo: ${Math.round(progress)}%`;
                            }, 
                            (error) => reject(error), 
                            async () => {
                                fileUrl = await getDownloadURL(uploadTask.snapshot.ref);
                                fileType = file.type;
                                resolve();
                            }
                        );
                    });
                }

                const newMemory = {
                    name: name,
                    message: message,
                    fileUrl: fileUrl,
                    fileType: fileType,
                    timestamp: Date.now()
                };

                await push(memoriesRef, newMemory);
                alert('¡Recuerdo enviado con éxito!');
                
            } catch (error) {
                console.error("Error al enviar el recuerdo:", error);
                alert(`Error al enviar: ${error.message}`);
            } finally {
                form.reset();
                fileNameDisplay.textContent = '';
                progressBarContainer.classList.add('hidden');
                progressBar.style.width = '0%';
                submitButton.disabled = false;
                if (fileInputPhoto) fileInputPhoto.value = '';
                if (fileInputVideo) fileInputVideo.value = '';
            }
        });
    }

    // Iniciar la escucha de mensajes (AHORA que 'memoriesRef' está definido)
    listenForMemories();
}

// =======================================================================
// LÓGICA PRINCIPAL (REESTRUCTURADA)
// =======================================================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // --- 1. OBTENER ID Y CARGAR CONFIGURACIÓN ---
        EVENT_ID = getEventId();
        await loadEventConfig(EVENT_ID); // Espera a que la config se cargue
        
        // --- 2. INICIALIZAR REFERENCIAS DE FIREBASE (⭐️ CORREGIDO) ---
        // Se construye la ruta completa directamente
        memoriesRef = dbRef(database, `events/${EVENT_ID}/data/memories`);
        
        // --- 3. INICIALIZAR EL PORTAL ---
        // Esta función ahora contiene todos los addEventListener
        initializePortal();

    } catch (error) {
        // Esto atrapará el error de 'getEventId' o 'loadEventConfig'
        console.error("Error al inicializar la aplicación:", error.message);
        // La app se detendrá aquí si el evento no existe o está inactivo
    }
});