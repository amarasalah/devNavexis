/**
 * TRIP PHOTOS MODULE
 * Gallery modal for admin to view trip confirmation photos
 * Shows begin/end photos (dashboard, truck, document, cargo)
 */

import { db, doc, getDoc, COLLECTIONS } from './firebase.js';

const PHOTO_LABELS = {
    dashboard: { label: 'Tableau de bord', icon: '📊' },
    fullTruck: { label: 'Camion complet', icon: '🚛' },
    document: { label: 'Document', icon: '📄' },
    cargo: { label: 'Chargement', icon: '📦' },
};

/**
 * Show a lightbox modal with trip photos for a planification
 * @param {string} planId - Planification ID
 */
async function showTripPhotos(planId) {
    try {
        const docSnap = await getDoc(doc(db, COLLECTIONS.planifications, planId));
        if (!docSnap.exists()) {
            alert('Planification non trouvée');
            return;
        }

        const plan = docSnap.data();
        const startPhotos = plan.startPhotos || null;
        const endPhotos = plan.endPhotos || null;

        if (!startPhotos && !endPhotos) {
            alert('Aucune photo de confirmation pour ce voyage');
            return;
        }

        renderGalleryModal(plan, startPhotos, endPhotos);
    } catch (err) {
        console.error('Error loading trip photos:', err);
        alert('Erreur: ' + err.message);
    }
}

function renderGalleryModal(plan, startPhotos, endPhotos) {
    // Remove any existing gallery modal
    document.getElementById('tripPhotosModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'tripPhotosModal';
    modal.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;overflow-y:auto;
            display:flex;justify-content:center;padding:20px">
            <div style="background:linear-gradient(135deg,#1e293b,#0f172a);border-radius:16px;
                max-width:900px;width:100%;border:1px solid rgba(148,163,184,0.1);max-height:90vh;overflow-y:auto">
                
                <!-- Header -->
                <div style="padding:20px 24px;border-bottom:1px solid rgba(148,163,184,0.1);
                    display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;
                    background:linear-gradient(135deg,#1e293b,#0f172a);z-index:1">
                    <div>
                        <h3 style="margin:0;color:#f1f5f9;font-size:18px">
                            📷 Photos de confirmation
                        </h3>
                        <div style="color:#94a3b8;font-size:13px;margin-top:4px">
                            ${plan.destination || 'Voyage'} • ${plan.date || ''}
                        </div>
                    </div>
                    <button onclick="document.getElementById('tripPhotosModal').remove()"
                        style="width:36px;height:36px;border-radius:50%;background:rgba(51,65,85,0.6);
                        border:none;color:#94a3b8;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center">
                        ✕
                    </button>
                </div>

                <!-- Content -->
                <div style="padding:24px">
                    ${startPhotos ? renderPhotoSection('🚛 Départ du voyage', 'Bon de commande', startPhotos) : ''}
                    ${endPhotos ? renderPhotoSection('🏁 Arrivée du voyage', 'Bon de livraison', endPhotos) : ''}
                    ${!startPhotos ? '<div style="text-align:center;color:#64748b;padding:20px">⏳ Photos de départ non encore envoyées</div>' : ''}
                    ${!endPhotos && startPhotos ? '<div style="text-align:center;color:#64748b;padding:20px">⏳ Photos d\'arrivée non encore envoyées</div>' : ''}
                </div>
            </div>
        </div>
    `;

    // Close on backdrop click
    modal.firstElementChild.addEventListener('click', (e) => {
        if (e.target === modal.firstElementChild) modal.remove();
    });

    document.body.appendChild(modal);
}

function renderPhotoSection(title, docLabel, photos) {
    const labels = { ...PHOTO_LABELS };
    labels.document = { label: docLabel, icon: '📄' };

    const timestamp = photos.timestamp
        ? new Date(photos.timestamp).toLocaleString('fr-FR')
        : '';

    return `
        <div style="margin-bottom:24px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <h4 style="margin:0;color:#f1f5f9;font-size:16px">${title}</h4>
                ${timestamp ? `<span style="color:#64748b;font-size:12px">📅 ${timestamp}</span>` : ''}
            </div>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
                ${Object.entries(labels).map(([key, { label, icon }]) => {
        const url = photos[key];
        if (!url) return `
                        <div style="aspect-ratio:4/3;background:rgba(15,23,42,0.5);border-radius:12px;
                            display:flex;align-items:center;justify-content:center;color:#475569;font-size:13px;
                            border:1px dashed rgba(148,163,184,0.2)">
                            ${icon} ${label} — Non fourni
                        </div>`;
        return `
                        <div style="position:relative;cursor:pointer" onclick="window.open('${url}','_blank')">
                            <img src="${url}" alt="${label}"
                                style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px;
                                border:1px solid rgba(148,163,184,0.1);transition:transform 0.2s"
                                onmouseover="this.style.transform='scale(1.02)'"
                                onmouseout="this.style.transform='scale(1)'">
                            <div style="position:absolute;bottom:0;left:0;right:0;padding:8px 12px;
                                background:linear-gradient(transparent,rgba(0,0,0,0.7));
                                border-radius:0 0 12px 12px;color:#fff;font-size:12px;font-weight:600">
                                ${icon} ${label}
                            </div>
                        </div>`;
    }).join('')}
            </div>
        </div>
    `;
}

export const TripPhotosModule = { showTripPhotos };
window.TripPhotosModule = TripPhotosModule;
