// =========================================================
// 🔥 Configuration et Initialisation Firebase
// (Vos paramètres réels)
// =========================================================
const firebaseConfig = {
  apiKey: "AIzaSyDtGiCjOy33ZI03QAe_ELIHfg9H05tVtK4",
  authDomain: "travaux-maison-9e170.firebaseapp.com",
  projectId: "travaux-maison-9e170",
  storageBucket: "travaux-maison-9e170.appspot.com",
  messagingSenderId: "34299316168",
  appId: "1:34299316168:web:d42197f3bdeb9d5759a2fd",
  measurementId: "G-7NVN7W9HXX"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const expensesRef = db.collection("expenses");

// =========================================================
// 🧩 DOM Cache & Utilitaires
// =========================================================

// Cache des éléments du formulaire
const expenseForm = document.getElementById("expense-form");
const dateInput = document.getElementById("date");
const typeInput = document.getElementById("type");
const categoryInput = document.getElementById("category");
const descriptionInput = document.getElementById("description");
const recipientInput = document.getElementById("recipient");
const amountInput = document.getElementById("amount");
const statusInput = document.getElementById("status");
const dueDateInput = document.getElementById("dueDate");
// NOUVEAU
const paidByInput = document.getElementById("paidBy");
const reimbursementStatusInput = document.getElementById("reimbursementStatus");

const addButton = document.getElementById("add-expense-btn");

// Cache des totaux et du conteneur des cartes
const outillageTotal = document.getElementById("outillage");
const prestationsTotal = document.getElementById("prestations");
const grossesTotal = document.getElementById("grosses");
const totalPaid = document.getElementById("total-paid");
const totalPending = document.getElementById("total-pending");
const cardsContainer = document.getElementById("cards-container");
const toastContainer = document.getElementById("toast-container");

// --- UTILS ---

const formatCurrency = (amount) => new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2
}).format(amount);

const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
        return new Date(dateString).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (e) {
        return dateString;
    }
}

/**
 * Affiche une notification non bloquante (Toast)
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle'}"></i><span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hide');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 4000);
}

// =========================================================
// ➕ Ajout de Dépense (Gestion du Formulaire)
// =========================================================

expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const amountValue = Number(amountInput.value);

    // Validation rapide
    if (!dateInput.value || !categoryInput.value || !descriptionInput.value || !amountInput.value || !recipientInput.value) {
        return showToast("Veuillez remplir tous les champs obligatoires !", 'error');
    }
    if (isNaN(amountValue) || amountValue <= 0) {
        return showToast("Le montant doit être un nombre positif.", 'error');
    }

    addButton.disabled = true;
    addButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ajout en cours...';

    try {
        await expensesRef.add({
            date: dateInput.value,
            type: typeInput.value,
            category: categoryInput.value,
            description: descriptionInput.value,
            recipient: recipientInput.value,
            amount: amountValue,

            // NOUVEAU: Champs Remboursement
            paidBy: paidByInput.value,
            reimbursementStatus: reimbursementStatusInput.value,

            status: statusInput.value,
            dueDate: dueDateInput.value || '',
        });

        expenseForm.reset();
        statusInput.value = 'Payé';
        showToast("Dépense ajoutée avec succès !", 'success');

    } catch (error) {
        console.error("Erreur d'ajout : ", error);
        showToast("Erreur lors de l'ajout de la dépense.", 'error');
    } finally {
        addButton.disabled = false;
        addButton.innerHTML = '<i class="fas fa-plus"></i> Ajouter la Dépense';
    }
});

// =========================================================
// 🔄 Temps Réel (Affichage des Données)
// =========================================================

expensesRef.orderBy("date", "desc").onSnapshot(snapshot => {
    let totals = { "Outillage": 0, "Prestations": 0, "Grosses dépenses": 0 };
    let totalPaidAmount = 0;
    let totalPendingAmount = 0;
    const today = new Date().toISOString().split('T')[0];
    cardsContainer.innerHTML = '';

    snapshot.forEach(doc => {
        const e = doc.data();
        const docId = doc.id;
        const amount = e.amount;

        // CORRECTION DE L'ERREUR 'undefined' ICI pour les anciens documents
        const expenseStatus = e.status || "Inconnu";
        const paidBy = e.paidBy || "Moi";
        const reimbursementStatus = e.reimbursementStatus || "N/A";

        const isPaid = expenseStatus === "Payé";
        const requiresReimbursement = (reimbursementStatus === "A rembourser");
        const isOverdue = e.dueDate && e.dueDate < today && !isPaid;

        totals[e.type] = (totals[e.type] || 0) + amount;
        isPaid ? (totalPaidAmount += amount) : (totalPendingAmount += amount);

        const statusClass = expenseStatus.toLowerCase().replace(' ', '-');
        const reimbursementClass = reimbursementStatus.toLowerCase().replace(' ', '-'); // NOUVEAU

        // --- Rendu de la carte avec Template Literals ---
        const cardHTML = `
            <div class="expense-card ${isPaid ? 'paid' : ''} ${isOverdue ? 'overdue' : ''}" data-id="${docId}">
                <div class="card-header">
                    <span class="card-type">${e.type} - **${e.category}**</span>
                    <span class="card-amount ${isPaid ? 'paid-amount' : 'pending-amount'}">${formatCurrency(amount)}</span>
                </div>

                <div class="card-details">
                    <p><strong>Description:</strong> ${e.description}</p>
                    <p><strong>Bénéficiaire:</strong> ${e.recipient || '-'}</p>
                    <p><strong>Payé par:</strong> ${paidBy}</p>
                    <p><strong>Date:</strong> ${formatDate(e.date)}</p>
                </div>

                <div class="card-footer">
                    <span class="status-badge status-${statusClass}">${expenseStatus}</span>
                    <span class="status-badge status-${reimbursementClass}">${reimbursementStatus}</span>
                    <span class="due-date">Échéance: ${formatDate(e.dueDate)}</span>
                </div>

                <div class="expense-actions">
                    ${!isPaid ? `<button class="action-btn pay-btn" onclick="updateStatusExpense('${docId}', 'Payé')"><i class="fas fa-check"></i> Payer Fournisseur</button>` : ''}

                    ${requiresReimbursement ?
                        `<button class="action-btn reimburse-btn" onclick="markReimbursed('${docId}')"><i class="fas fa-hand-holding-usd"></i> Rembourser ${paidBy}</button>`
                        : ''}

                    <button class="action-btn postpone-btn" onclick="postponeExpense('${docId}', '${e.dueDate || ''}')"><i class="fas fa-clock"></i> Reporter</button>
                    <button class="action-btn delete-btn" onclick="deleteExpense('${docId}')"><i class="fas fa-trash"></i> Supprimer</button>
                </div>
            </div>
        `;
        cardsContainer.insertAdjacentHTML('beforeend', cardHTML);
    });

    // Mise à jour des totaux dans le dashboard
    outillageTotal.textContent = formatCurrency(totals.Outillage);
    prestationsTotal.textContent = formatCurrency(totals.Prestations);
    grossesTotal.textContent = formatCurrency(totals["Grosses dépenses"]);
    totalPaid.textContent = formatCurrency(totalPaidAmount);
    totalPending.textContent = formatCurrency(totalPendingAmount);
});

// =========================================================
// 🗑️ Actions de Dépense (CRUD)
// =========================================================

// Supprimer (rendu global)
window.deleteExpense = async (id) => {
    if (!confirm("Confirmer la suppression de cette dépense ?")) return;
    try {
        await expensesRef.doc(id).delete();
        showToast("Dépense supprimée !", 'success');
    } catch (error) {
        showToast("Erreur lors de la suppression.", 'error');
        console.error("Erreur de suppression : ", error);
    }
}

// Mettre à jour le Statut (rendu global)
window.updateStatusExpense = async (id, newStatus) => {
    try {
        await expensesRef.doc(id).update({ status: newStatus });
        showToast(`Statut fournisseur mis à jour à "${newStatus}" !`, 'success');
    } catch (error) {
        showToast("Erreur lors de la mise à jour du statut.", 'error');
        console.error("Erreur de mise à jour du statut : ", error);
    }
}

// NOUVEAU : Marquer comme Remboursé (rendu global)
window.markReimbursed = async (id) => {
    if (!confirm("Confirmer le remboursement de cette dépense ?")) return;
    try {
        await expensesRef.doc(id).update({ reimbursementStatus: "Remboursé" });
        showToast("Remboursement marqué comme effectué !", 'success');
    } catch (error) {
        showToast("Erreur lors de la mise à jour du remboursement.", 'error');
        console.error("Erreur de mise à jour du remboursement : ", error);
    }
}


// Reporter l'échéance (rendu global)
window.postponeExpense = async (id, currentDueDate) => {
    const newDate = prompt("Nouvelle date d'échéance ? (Format YYYY-MM-DD)", currentDueDate);

    if (newDate && newDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        try {
            await expensesRef.doc(id).update({
                dueDate: newDate,
                status: "En attente"
            });
            showToast(`Échéance reportée au ${formatDate(newDate)}. Statut: En attente.`, 'info');
        } catch (error) {
            showToast("Erreur lors du report.", 'error');
            console.error("Erreur de report : ", error);
        }
    } else if (newDate) {
        showToast("Format de date invalide. Utilisez YYYY-MM-DD.", 'error');
    }
}