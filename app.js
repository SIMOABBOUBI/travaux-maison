// app.js

// =========================================================
// 🔥 Configuration et Initialisation Firebase
// IMPORTANT: REMPLACEZ PAR VOTRE VÉRITABLE CONFIGURATION
// =========================================================
const firebaseConfig = {
    apiKey: "AIzaSyDtGiCjOy33ZI03QAe_ELIHfg9H05tVtK4", // A MODIFIER
    authDomain: "travaux-maison-9e170.firebaseapp.com", // A MODIFIER
    projectId: "travaux-maison-9e170", // A MODIFIER
    storageBucket: "travaux-maison-9e170.appspot.com",
    messagingSenderId: "34299316168",
    appId: "1:34299316168:web:d42197f3bdeb9d5759a2fd",
    measurementId: "G-7NVN7W9HXX"
};

// Initialisation de Firebase
// Assurez-vous d'avoir inclus les scripts Firebase dans votre HTML
if (typeof firebase !== 'undefined' && firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const expensesRef = db.collection("expenses");
const tasksRef = db.collection("tasks");

// Détecter la page actuelle
const isExpensePage = window.location.pathname.includes('index.html') || window.location.pathname === '/';
const isTaskPage = window.location.pathname.includes('tasks.html');

// Variable globale pour stocker les données de dépenses (pour le PDF)
let allExpensesData = [];

// =========================================================
// 🧩 DOM Cache & Utilitaires (Communs)
// =========================================================

const toastContainer = document.getElementById("toast-container");

const formatCurrency = (amount) => new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2
}).format(amount);

const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
        // Ajout de 'T00:00:00' pour gérer les différences de fuseau horaire
        return new Date(dateString + 'T00:00:00').toLocaleDateString('fr-FR', {
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
// 💸 LOGIQUE DÉPENSES (Si nous sommes sur index.html)
// =========================================================

if (isExpensePage) {
    const BUDGET_CIBLE = { "Outillage": 10000, "Prestations": 24000, "Grosses dépenses": 60000, "Total": 94000 };

    // Cache des Totaux et des Conteneurs
    const outillageTotal = document.getElementById("outillage");
    const prestationsTotal = document.getElementById("prestations");
    const grossesTotal = document.getElementById("grosses");
    const totalPaid = document.getElementById("total-paid");
    const totalPending = document.getElementById("total-pending");
    const cardsContainer = document.getElementById("cards-container");
    const overallProgress = document.getElementById("overall-progress");
    const progressTracker = document.getElementById("progress-tracker");
    const totalBudgetTracker = document.getElementById("total-budget-tracker");
    const exportPdfBtn = document.getElementById("export-pdf-btn");

    // Éléments Formulaire
    const expenseForm = document.getElementById("expense-form");
    const dateInput = document.getElementById("date");
    const addButton = document.getElementById("add-expense-btn");

    // Initialisation
    document.addEventListener('DOMContentLoaded', () => {
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
        }
        document.getElementById("outillage-budget").textContent = formatCurrency(BUDGET_CIBLE.Outillage);
        document.getElementById("prestations-budget").textContent = formatCurrency(BUDGET_CIBLE.Prestations);
        document.getElementById("grosses-budget").textContent = formatCurrency(BUDGET_CIBLE["Grosses dépenses"]);
        document.getElementById("total-budget").textContent = formatCurrency(BUDGET_CIBLE.Total);

        if (totalBudgetTracker) {
            totalBudgetTracker.textContent = `Budget Cible: ${formatCurrency(BUDGET_CIBLE.Total)}`;
        }
    });

    // Soumission du formulaire
    expenseForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(expenseForm);
        const data = Object.fromEntries(formData.entries());
        data.amount = Number(data.amount);

        if (isNaN(data.amount) || data.amount <= 0) {
             return showToast("Le montant doit être un nombre positif.", 'error');
        }

        addButton.disabled = true;
        addButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ajout en cours...';

        try {
            await expensesRef.add(data);

            expenseForm.reset();
            document.getElementById("status").value = 'Payé';
            document.getElementById("date").value = new Date().toISOString().split('T')[0];
            showToast("Dépense ajoutée avec succès !", 'success');

        } catch (error) {
            console.error("Erreur d'ajout : ", error);
            showToast("Erreur lors de l'ajout de la dépense.", 'error');
        } finally {
            addButton.disabled = false;
            addButton.innerHTML = '<i class="fas fa-plus"></i> Ajouter la Dépense';
        }
    });

    // Écoute des Dépenses en temps réel
    expensesRef.orderBy("date", "desc").onSnapshot(snapshot => {
        let totals = { "Outillage": 0, "Prestations": 0, "Grosses dépenses": 0 };
        let totalPaidAmount = 0;
        let totalPendingAmount = 0;
        const today = new Date().toISOString().split('T')[0];

        let groupedExpenses = {
            "Grosses dépenses": [], // Mis en premier pour l'ordre d'affichage
            "Prestations": [],
            "Outillage": []
        };

        cardsContainer.innerHTML = '';
        allExpensesData = [];

        snapshot.forEach(doc => {
            const e = doc.data();
            const docId = doc.id;
            const amount = e.amount;

            const expenseStatus = e.status || "Inconnu";
            const reimbursementStatus = e.reimbursementStatus || "N/A";
            const isPaid = expenseStatus === "Payé";
            const requiresReimbursement = (reimbursementStatus === "A rembourser");
            const isOverdue = e.dueDate && e.dueDate < today && !isPaid;

            totals[e.type] = (totals[e.type] || 0) + amount;
            isPaid ? (totalPaidAmount += amount) : (totalPendingAmount += amount);

            // --- Construction des données pour la carte HTML ---
            const statusClass = expenseStatus.toLowerCase().replace(' ', '-');
            const reimbursementClass = reimbursementStatus.toLowerCase().replace(' ', '-').replace('/', '');

            const cardHTML = `
                <div class="expense-card ${isPaid ? 'paid' : ''} ${isOverdue ? 'overdue' : ''}" data-id="${docId}">
                    <div class="card-header">
                        <span class="card-type">${e.type} - **${e.category}**</span>
                        <span class="card-amount ${isPaid ? 'paid-amount' : 'pending-amount'}">${formatCurrency(amount)}</span>
                    </div>

                    <div class="card-details">
                        <p><strong>Description:</strong> ${e.description}</p>
                        <p><strong>Bénéficiaire:</strong> ${e.recipient || '-'}</p>
                        <p><strong>Payé par:</strong> ${e.paidBy || 'Moi'}</p>
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
                            `<button class="action-btn reimburse-btn" onclick="markReimbursed('${docId}')"><i class="fas fa-hand-holding-usd"></i> Rembourser</button>`
                            : ''}
                        <button class="action-btn postpone-btn" onclick="postponeExpense('${docId}', '${e.dueDate || ''}')"><i class="fas fa-clock"></i> Reporter</button>
                        <button class="action-btn delete-btn" onclick="deleteExpense('${docId}')"><i class="fas fa-trash"></i> Supprimer</button>
                    </div>
                </div>
            `;
            // Ajout à la structure groupée
            if (groupedExpenses[e.type]) {
                groupedExpenses[e.type].push(cardHTML);
            }

            // Enregistrement des données pour l'export PDF
            allExpensesData.push({
                date: formatDate(e.date),
                type: e.type,
                category: e.category,
                description: e.description,
                recipient: e.recipient,
                amount: e.amount,
                paidBy: e.paidBy,
                status: e.status,
                reimbursementStatus: e.reimbursementStatus,
                dueDate: formatDate(e.dueDate)
            });
        });

        // --- Génération de la vue Arborescence ---
        let treeHTML = '';
        const categoriesOrder = ["Grosses dépenses", "Prestations", "Outillage"]; // Ordre d'affichage

        categoriesOrder.forEach(category => {
            const expenses = groupedExpenses[category];
            const categoryTotal = totals[category];

            if (expenses && expenses.length > 0) {
                treeHTML += `
                    <div class="category-node" data-category="${category.replace(' ', '-')}" id="node-${category.replace(' ', '-')}" ${category === "Grosses dépenses" ? 'class="category-node open"' : ''}>
                        <div class="category-header">
                            <h3><i class="fas fa-chevron-right toggle-icon"></i> ${category} (${expenses.length} dépense${expenses.length > 1 ? 's' : ''})</h3>
                            <span>${formatCurrency(categoryTotal)}</span>
                        </div>
                        <div class="category-content">
                            ${expenses.join('')}
                        </div>
                    </div>
                `;
            }
        });

        cardsContainer.innerHTML = treeHTML;

        // --- Logique d'ouverture/fermeture (Toggle) ---
        document.querySelectorAll('.category-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const node = header.closest('.category-node');
                node.classList.toggle('open');
            });
        });

        // Mise à jour des totaux et de la barre de progression
        const totalSpent = totalPaidAmount + totalPendingAmount;
        const totalBudgetAmount = BUDGET_CIBLE.Total;

        const progressPercentage = (totalSpent / totalBudgetAmount) * 100;
        const clampedProgress = Math.min(100, Math.round(progressPercentage));
        const progressText = progressPercentage > 100 ? `Dépassement de ${formatCurrency(totalSpent - totalBudgetAmount)}` : `${clampedProgress}% Atteint`;

        outillageTotal.textContent = formatCurrency(totals.Outillage);
        prestationsTotal.textContent = formatCurrency(totals.Prestations);
        grossesTotal.textContent = formatCurrency(totals["Grosses dépenses"]);
        totalPaid.textContent = formatCurrency(totalPaidAmount);
        totalPending.textContent = formatCurrency(totalPendingAmount);

        overallProgress.style.width = `${clampedProgress}%`;
        progressTracker.querySelector('p').textContent = progressText;
        progressTracker.querySelector('span:first-of-type').textContent = `Total Dépensé: ${formatCurrency(totalSpent)}`;
    });

    // Fonctions CRUD des Dépenses (rendues globales pour les onclick)
    window.deleteExpense = async (id) => {
        if (!confirm("Confirmer la suppression de cette dépense ?")) return;
        try {
            await expensesRef.doc(id).delete();
            showToast("Dépense supprimée !", 'success');
        } catch (error) {
            showToast("Erreur lors de la suppression.", 'error');
        }
    }

    window.updateStatusExpense = async (id, newStatus) => {
        try {
            await expensesRef.doc(id).update({ status: newStatus });
            showToast(`Statut fournisseur mis à jour à "${newStatus}" !`, 'success');
        } catch (error) {
            showToast("Erreur lors de la mise à jour du statut.", 'error');
        }
    }

    window.markReimbursed = async (id) => {
        if (!confirm("Confirmer le remboursement de cette dépense ?")) return;
        try {
            await expensesRef.doc(id).update({ reimbursementStatus: "Remboursé" });
            showToast("Remboursement marqué comme effectué !", 'success');
        } catch (error) {
            showToast("Erreur lors de la mise à jour du remboursement.", 'error');
        }
    }

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
            }
        } else if (newDate) {
            showToast("Format de date invalide. Utilisez YYYY-MM-DD.", 'error');
        }
    }

    // =========================================================
    // 🖨️ FONCTION D'EXPORTATION PDF
    // =========================================================

    function exportExpensesToPDF() {
        if (!allExpensesData || allExpensesData.length === 0) {
            showToast("Aucune dépense à exporter.", 'info');
            return;
        }

        try {
            // S'assurer que les bibliothèques sont chargées
            if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
                 throw new Error("jsPDF library is not loaded.");
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape');

            // 1. Préparation des données pour autoTable
            const headers = [
                ['Date', 'Type', 'Catégorie', 'Description', 'Montant (€)', 'Payé par', 'Statut', 'Remb.', 'Échéance']
            ];

            let totalSpent = 0;
            const body = allExpensesData.map(e => {
                totalSpent += e.amount;
                return [
                    e.date,
                    e.type,
                    e.category,
                    e.description.length > 30 ? e.description.substring(0, 27) + '...' : e.description,
                    formatCurrency(e.amount),
                    e.paidBy,
                    e.status,
                    e.reimbursementStatus,
                    e.dueDate
                ];
            });

            // 2. Ajout du titre
            doc.setFontSize(18);
            doc.text("Rapport de Suivi des Dépenses Travaux", 14, 20);

            // 3. Ajout des totaux
            doc.setFontSize(10);
            doc.text(`Total Dépensé: ${formatCurrency(totalSpent)}`, 14, 28);
            doc.text(`Date de Génération: ${formatDate(new Date().toISOString().split('T')[0])}`, 14, 34);

            // 4. Génération du tableau avec autoTable
            doc.autoTable({
                head: headers,
                body: body,
                startY: 40,
                theme: 'striped',
                styles: {
                    fontSize: 8,
                    cellPadding: 2,
                    overflow: 'linebreak'
                },
                headStyles: {
                    fillColor: [26, 115, 232]
                },
                columnStyles: {
                    4: { cellWidth: 20 },
                    8: { cellWidth: 20 }
                }
            });

            // 5. Enregistrement du fichier
            doc.save(`Rapport_Depenses_Travaux_${new Date().toISOString().split('T')[0]}.pdf`);
            showToast("Fichier PDF généré avec succès !", 'success');

        } catch (e) {
            console.error("Erreur lors de la génération du PDF:", e);
            showToast("Impossible de générer le PDF. Vérifiez la console et les liens jsPDF.", 'error');
        }
    }

    // Événement du bouton d'exportation PDF
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', exportExpensesToPDF);
    }
}


// =========================================================
// 🚧 LOGIQUE TÂCHES (Si nous sommes sur tasks.html)
// =========================================================

if (isTaskPage) {
    // Cache des Tâches
    const taskForm = document.getElementById("task-form");
    const addTaskButton = document.getElementById("add-task-btn");
    const tasksContainer = document.getElementById("tasks-container");
    const overallTaskProgressText = document.getElementById("overall-task-progress");
    const taskProgressBar = document.getElementById("task-progress-bar");

    // Récupérer les inputs nécessaires au formulaire Tâches
    const taskLocationInput = document.getElementById("task-location");
    const taskNameInput = document.getElementById("task-name");
    const taskPriorityInput = document.getElementById("task-priority");
    const taskProgressInput = document.getElementById("task-progress");
    const taskResponsibleInput = document.getElementById("task-responsible");
    const taskEstimatedCostInput = document.getElementById("task-estimatedCost");
    const taskDueDateInput = document.getElementById("task-taskDueDate");
    const taskMaterialsLinkInput = document.getElementById("task-materialsLink");

    // Soumission du formulaire Tâches
    taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const estimatedCostValue = Number(taskEstimatedCostInput.value) || 0;
        const progressValue = Number(taskProgressInput.value) || 0;
        const isCompleted = progressValue === 100;

        if (!taskNameInput.value || !taskLocationInput.value) {
            return showToast("Veuillez remplir le nom et la localisation de la tâche.", 'error');
        }

        addTaskButton.disabled = true;
        addTaskButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ajout en cours...';

        try {
            await tasksRef.add({
                name: taskNameInput.value,
                location: taskLocationInput.value,
                priority: taskPriorityInput.value,
                responsible: taskResponsibleInput.value,
                taskDueDate: taskDueDateInput.value || '',
                estimatedCost: estimatedCostValue,
                progress: progressValue,
                materialsLink: taskMaterialsLinkInput.value || '',
                completed: isCompleted,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            taskForm.reset();
            taskResponsibleInput.value = 'Kimberley';
            taskPriorityInput.value = 'Moyenne';
            taskProgressInput.value = '0';

            showToast("Tâche ajoutée avec succès !", 'success');

        } catch (error) {
            console.error("Erreur d'ajout de tâche : ", error);
            showToast("Erreur lors de l'ajout de la tâche.", 'error');
        } finally {
            addTaskButton.disabled = false;
            addTaskButton.innerHTML = '<i class="fas fa-check-double"></i> Ajouter la Tâche';
        }
    });

    // Écoute des Tâches en temps réel
    tasksRef.orderBy("createdAt", "asc").onSnapshot(snapshot => {
        let totalTasks = 0;
        let completedTasks = 0;
        tasksContainer.innerHTML = '';
        const today = new Date().toISOString().split('T')[0];

        snapshot.forEach(doc => {
            const t = doc.data();
            const docId = doc.id;

            totalTasks++;
            if (t.completed) {
                completedTasks++;
            }

            const isOverdue = t.taskDueDate && t.taskDueDate < today && !t.completed;
            const priorityClass = t.priority ? t.priority.toLowerCase() : 'moyenne';
            let priorityColor;
            switch (t.priority) {
                case 'Haute': priorityColor = '#dc3545'; break;
                case 'Moyenne': priorityColor = '#ff9800'; break;
                case 'Bloquée': priorityColor = '#6c757d'; break;
                default: priorityColor = '#28a745'; break;
            }

            const taskProgress = t.progress || 0;
            const completionText = taskProgress === 100 ? "Terminée" : `${taskProgress}%`;
            const taskCompletedClass = t.completed || taskProgress === 100 ? 'task-completed' : '';


            const taskHTML = `
                <div class="task-card task-priority-${priorityClass} ${taskCompletedClass} ${isOverdue ? 'task-overdue' : ''}" data-id="${docId}">
                    <div class="task-info">
                        <input type="checkbox" id="task-${docId}" ${t.completed ? 'checked' : ''} onchange="toggleTaskStatus('${docId}', ${t.completed})">
                        <label for="task-${docId}">
                            <span class="task-name">${t.name}</span>
                            <span class="task-location" style="color: #1a73e8; font-weight: 700;">[${t.location}]</span>
                            <span class="task-responsible">(${t.responsible})</span>
                        </label>
                    </div>
                    <div class="task-meta">
                        <span class="task-priority-badge" style="background-color: ${priorityColor}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.8em;">${t.priority}</span>

                        <span class="task-progress-indicator">${completionText}</span>

                        ${t.estimatedCost > 0 ?
                            `<span class="task-cost">Budget: ${formatCurrency(t.estimatedCost)}</span>`
                            : ''}

                        ${t.materialsLink ?
                            `<a href="${t.materialsLink}" target="_blank" class="status-badge status-total" title="Voir les matériaux/référence">
                                <i class="fas fa-link"></i> Réf.
                            </a>`
                            : ''}

                        <span class="task-due-date">Échéance: ${formatDate(t.taskDueDate)}</span>

                        <button class="action-btn update-progress-btn" onclick="promptUpdateTaskProgress('${docId}', ${taskProgress})" title="Modifier l'avancement">
                            <i class="fas fa-edit"></i>
                        </button>

                        <button class="action-btn delete-task-btn" onclick="deleteTask('${docId}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
            tasksContainer.insertAdjacentHTML('beforeend', taskHTML);
        });

        // Mise à jour de la barre de progression des tâches
        updateTaskProgress(totalTasks, completedTasks);
    });

    // Fonctions CRUD des Tâches (rendues globales pour les onclick)
    function updateTaskProgress(totalTasks, completedTasks) {
        const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        if (overallTaskProgressText && taskProgressBar) {
            overallTaskProgressText.textContent = `${percentage}% (${completedTasks} / ${totalTasks} Tâches Terminées)`;
            taskProgressBar.style.width = `${percentage}%`;
        }
    }

    window.promptUpdateTaskProgress = async (id, currentProgress) => {
        const newProgressStr = prompt(
            `Modifier l'avancement de la tâche (valeur actuelle: ${currentProgress}%) ?\n\nVeuillez entrer un pourcentage entre 0 et 100 :`,
            currentProgress
        );

        if (newProgressStr === null) return;

        const newProgress = parseInt(newProgressStr);

        if (isNaN(newProgress) || newProgress < 0 || newProgress > 100) {
            return showToast("Pourcentage invalide. Veuillez entrer un nombre entier entre 0 et 100.", 'error');
        }

        const newCompletedStatus = newProgress === 100;
        const updateData = { progress: newProgress, completed: newCompletedStatus };

        if (newCompletedStatus) {
            updateData.completedAt = firebase.firestore.FieldValue.serverTimestamp();
        } else if (newProgress < 100) {
            updateData.completedAt = firebase.firestore.FieldValue.delete();
        }

        try {
            await tasksRef.doc(id).update(updateData);
            showToast(`Avancement mis à jour à ${newProgress}% !`, 'success');
        } catch (error) {
            showToast("Erreur lors de la mise à jour de l'avancement.", 'error');
        }
    };

    window.toggleTaskStatus = async (id, currentCompletedStatus) => {
        const newCompletedStatus = !currentCompletedStatus;
        const newProgress = newCompletedStatus ? 100 : 0;

        const updateData = {
            completed: newCompletedStatus,
            progress: newProgress,
        };

        if (newCompletedStatus) {
            updateData.completedAt = firebase.firestore.FieldValue.serverTimestamp();
        } else {
            updateData.completedAt = firebase.firestore.FieldValue.delete();
        }

        try {
            await tasksRef.doc(id).update(updateData);
            showToast(newCompletedStatus ? "Tâche marquée comme terminée !" : "Tâche réouverte.", 'info');
        } catch (error) {
            showToast("Erreur lors de la mise à jour du statut de la tâche.", 'error');
        }
    }

    window.deleteTask = async (id) => {
        if (!confirm("Confirmer la suppression de cette tâche ?")) return;
        try {
            await tasksRef.doc(id).delete();
            showToast("Tâche supprimée !", 'success');
        } catch (error) {
            showToast("Erreur lors de la suppression de la tâche.", 'error');
        }
    }
}