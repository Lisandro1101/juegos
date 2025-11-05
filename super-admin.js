import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
// ⭐️ IMPORTACIONES ACTUALIZADAS
import { getDatabase, ref, set, onValue, remove } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// =======================================================================
// CONFIGURACIÓN DE FIREBASE
// =======================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDRsS6YQ481KQadSk8gf9QtxVt_asnrDlc", // Reemplaza con tus datos
  authDomain: "juegos-cumple.firebaseapp.com", // Reemplaza con tus datos
  databaseURL: "https://juegos-cumple-default-rtdb.firebaseio.com", // Reemplaza con tus datos
  projectId: "juegos-cumple", // Reemplaza con tus datos
  storageBucket: "juegos-cumple.firebasestorage.app", // Reemplaza con tus datos
  messagingSenderId: "595312538655", // Reemplaza con tus datos
  appId: "1:595312538655:web:93220a84570ff7461fd12a", // Reemplaza con tus datos
  measurementId: "G-V1YXNZXVQR" // Reemplaza con tus datos
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const storage = getStorage(app);

document.addEventListener('DOMContentLoaded', () => {
    // 1. DEFINIR VARIABLES DEL FORMULARIO
    const form = document.getElementById('event-form');
    const saveBtn = document.getElementById('save-event-btn');
    const statusMsg = document.getElementById('status-message');

    // ⭐️ 2. NUEVAS VARIABLES PARA LA LISTA DE EVENTOS
    const eventsListElement = document.getElementById('existing-events-list');
    const eventsListRef = ref(database, 'events'); // Referencia al nodo principal 'events'


    // 3. ASIGNAR EVENTOS
    form.addEventListener('submit', handleFormSubmit);
    eventsListElement.addEventListener('click', handleDeleteClick); // Listener para los botones de eliminar
    onValue(eventsListRef, renderEventsList); // Escuchar cambios en la lista de eventos

    
    // --- FUNCIÓN PARA CREAR/ACTUALIZAR EVENTO (Sin cambios) ---
    async function handleFormSubmit(e) {
        e.preventDefault();
        saveBtn.disabled = true;
        statusMsg.textContent = 'Guardando...';

        const eventId = document.getElementById('event-id').value.trim().toLowerCase();
        const gamesEnabled = document.getElementById('games-enabled').checked;
        const eventActive = document.getElementById('event-active').checked;

        if (!eventId) {
            alert('El ID del Evento es obligatorio.');
            statusMsg.textContent = 'Error: Falta ID del Evento.';
            saveBtn.disabled = false;
            return;
        }
        
        const themeConfig = {
            color_primary: document.getElementById('color-primary').value,
            color_secondary: document.getElementById('color-secondary').value,
            color_text: document.getElementById('color-text').value,
            font_family: document.getElementById('font-family').value,
        };
        
        const fullConfig = {
            theme: themeConfig,
            features: {
                games_enabled: gamesEnabled
            },
            status: {
                is_active: eventActive
            }
        };

        try {
            const imageFile = document.getElementById('bg-image').files[0];
            if (imageFile) {
                statusMsg.textContent = 'Subiendo imagen de fondo...';
                const imagePath = `events/${eventId}/theme/background.${imageFile.name.split('.').pop()}`;
                const sRef = storageRef(storage, imagePath);
                const uploadTask = await uploadBytesResumable(sRef, imageFile);
                const downloadURL = await getDownloadURL(uploadTask.ref);
                
                fullConfig.theme.background_image_url = downloadURL; 
                statusMsg.textContent = 'Imagen subida. Guardando config...';
            } else {
                statusMsg.textContent = 'Guardando configuración...';
            }
            
            const dbConfigRef = ref(database, `events/${eventId}/config`);
            await set(dbConfigRef, fullConfig);

            statusMsg.textContent = `¡Éxito! Evento "${eventId}" guardado/actualizado.`;

        } catch (error) {
            console.error("Error al guardar:", error);
            statusMsg.textContent = `Error: ${error.message}`;
        } finally {
            saveBtn.disabled = false;
        }
    }

    // --- ⭐️ NUEVA FUNCIÓN: RENDERIZAR LA LISTA DE EVENTOS ---
    function renderEventsList(snapshot) {
        eventsListElement.innerHTML = ''; // Limpiar lista
        if (!snapshot.exists()) {
            eventsListElement.innerHTML = '<li class="p-2 text-gray-500 italic text-center">No hay eventos creados.</li>';
            return;
        }

        snapshot.forEach((childSnapshot) => {
            const eventId = childSnapshot.key;
            const li = document.createElement('li');
            // Reutilizar estilos de host.html
            li.className = 'question-item'; 
            li.innerHTML = `
                <div class="q-display">
                    <strong class="text-gray-700">${eventId}</strong>
                </div>
                <button class="delete-btn" data-id="${eventId}">Eliminar</button>
            `;
            eventsListElement.appendChild(li);
        });
    }

    // --- ⭐️ NUEVA FUNCIÓN: MANEJAR ELIMINACIÓN DE EVENTO ---
    async function handleDeleteClick(e) {
        if (!e.target.classList.contains('delete-btn')) {
            return; // No fue el botón de eliminar
        }

        const eventIdToDelete = e.target.dataset.id;
        
        // Medida de seguridad: Pedir al usuario que escriba el ID
        const confirmation = prompt(`🚨 ACCIÓN DESTRUCTIVA 🚨\nEsto eliminará el evento "${eventIdToDelete}" y TODOS sus datos (juegos, recuerdos, etc).\n\nPara confirmar, escribe el ID del evento ("${eventIdToDelete}"):`);
        
        if (confirmation !== eventIdToDelete) {
            alert('Confirmación cancelada o incorrecta. No se eliminó nada.');
            return;
        }

        try {
            // Referencia al nodo completo del evento (ej: /events/boda-ana)
            const eventRefToDelete = ref(database, `events/${eventIdToDelete}`);
            await remove(eventRefToDelete);
            
            // NOTA: Esto elimina los datos de Realtime Database.
            // Los archivos en Storage (fotos, videos) NO se eliminan automáticamente.
            // Borrarlos requeriría una lógica más compleja (Cloud Function).
            
            alert(`¡Evento "${eventIdToDelete}" eliminado con éxito!`);
            // La lista se actualizará sola gracias a onValue.
        } catch (error) {
            console.error("Error al eliminar el evento:", error);
            alert(`Error al eliminar: ${error.message}`);
        }
    }
});