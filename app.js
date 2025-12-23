// --- CONFIGURATION FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyDtGiCjOy33ZI03QAe_ELIHfg9H05tVtK4",
    authDomain: "travaux-maison-9e170.firebaseapp.com",
    projectId: "travaux-maison-9e170",
    storageBucket: "travaux-maison-9e170.appspot.com",
    messagingSenderId: "34299316168",
    appId: "1:34299316168:web:d42197f3bdeb9d5759a2fd"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ==========================================================
// PARTIE 1 : LOGIQUE BUDGET (index.html)
// ==========================================================
const budgetForm = document.getElementById("expense-form");
if (budgetForm) {
    const expensesRef = db.collection("expenses");
    let editingId = null;

    // Protection PDF : On vérifie si le bouton existe avant l'écouteur
    const pdfBtn = document.getElementById('export-pdf');
    if (pdfBtn) {
        pdfBtn.addEventListener('click', async () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape');
            const snap = await expensesRef.orderBy("date").get();
            doc.text("RAPPORT DES DÉPENSES", 14, 15);
            const rows = [];
            snap.forEach(d => {
                const v = d.data();
                rows.push([v.date, v.type, v.category, v.beneficiary || v.recipient || "", `${v.amount}€`, v.paidBy, v.status]);
            });
            doc.autoTable({ head: [['Date', 'Type', 'Catégorie', 'Bénéficiaire', 'Montant', 'Payeur', 'Statut']], body: rows, startY: 25 });
            doc.save("budget-chantier.pdf");
        });
    }

    // Protection Recherche Budget
    const searchBudget = document.getElementById("expense-search");
    if (searchBudget) {
        searchBudget.addEventListener("input", (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll(".expense-card").forEach(card => {
                card.style.display = card.innerText.toLowerCase().includes(term) ? "block" : "none";
            });
        });
    }

    // Fonctions globales
    window.prepareEdit = async (id) => {
        const doc = await expensesRef.doc(id).get();
        const d = doc.data();
        editingId = id;
        document.getElementById('date').value = d.date || "";
        document.getElementById('type').value = d.type || "";
        document.getElementById('category').value = d.category || "";
        document.getElementById('description').value = d.description || "";
        document.getElementById('beneficiary').value = d.beneficiary || d.recipient || "";
        document.getElementById('amount').value = d.amount || "";
        document.getElementById('paidBy').value = d.paidBy || "";
        document.getElementById('refundStatus').value = d.refundStatus || "";
        document.getElementById('status').value = d.status || "";
        document.getElementById('dueDate').value = d.dueDate || "";
        document.getElementById("form-container").classList.add("edit-mode-active");
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.deleteExpense = async (id) => { if (confirm("Supprimer ?")) await expensesRef.doc(id).delete(); };

    budgetForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = {
            date: document.getElementById('date').value,
            type: document.getElementById('type').value,
            category: document.getElementById('category').value,
            description: document.getElementById('description').value,
            beneficiary: document.getElementById('beneficiary').value,
            amount: parseFloat(document.getElementById('amount').value),
            paidBy: document.getElementById('paidBy').value,
            refundStatus: document.getElementById('refundStatus').value,
            status: document.getElementById('status').value,
            dueDate: document.getElementById('dueDate').value
        };
        editingId ? await expensesRef.doc(editingId).update(data) : await expensesRef.add(data);
        e.target.reset();
        editingId = null;
        document.getElementById("form-container").classList.remove("edit-mode-active");
    });

    expensesRef.orderBy("date", "desc").onSnapshot(snap => {
        const container = document.getElementById("cards-container");
        if(!container) return;
        let grouped = { "Grosses dépenses": [], "Prestations": [], "Outillage": [], "Petites dépenses": [] };
        let paidTotal = 0, pendingTotal = 0;
        let catTotals = { "Grosses dépenses": 0, "Prestations": 0, "Outillage": 0, "Petites dépenses": 0 };

        snap.forEach(doc => {
            const d = doc.data();
            const isPaid = (d.status === "Payé" || d.status === "Total");
            isPaid ? paidTotal += d.amount : pendingTotal += d.amount;
            if (catTotals[d.type] !== undefined) catTotals[d.type] += d.amount;

            const card = `
                <div class="expense-card ${isPaid ? 'paid' : ''}">
                    <div style="display:flex; justify-content:space-between;">
                        <strong>${d.category}</strong>
                        <span style="font-weight:800;">${d.amount.toFixed(2)} €</span>
                    </div>
                    <div style="font-size:0.8rem; color:#555; margin:10px 0;">
                        👤 ${d.beneficiary || d.recipient || 'N/A'} | 💳 ${d.paidBy}<br>
                        📅 ${d.date} | ⏳ Échéance: ${d.dueDate || 'Non définie'}
                    </div>
                    <div class="card-actions">
                        <button class="edit-btn" onclick="prepareEdit('${doc.id}')">Modifier</button>
                        <button class="del-btn" onclick="deleteExpense('${doc.id}')">Supprimer</button>
                    </div>
                </div>`;
            if (grouped[d.type]) grouped[d.type].push(card);
        });

        let html = "";
        for (const [name, cards] of Object.entries(grouped)) {
            if (cards.length > 0) {
                html += `<div class="category-node">
                    <div class="category-header" onclick="this.parentElement.classList.toggle('open')">
                        <span><i class="fas fa-folder"></i> ${name.toUpperCase()} (${cards.length})</span>
                        <span>${catTotals[name].toFixed(2)} €</span>
                    </div>
                    <div class="category-content">${cards.join('')}</div>
                </div>`;
            }
        }
        container.innerHTML = html;
        document.getElementById("total-paid").innerText = paidTotal.toLocaleString('fr-FR') + " €";
        document.getElementById("total-pending").innerText = pendingTotal.toLocaleString('fr-FR') + " €";
    });
}

// ==========================================================
// PARTIE 2 : LOGIQUE TÂCHES (tasks.html)
// ==========================================================
const taskForm = document.getElementById("task-form");
if (taskForm) {
    const tasksRef = db.collection("tasks");
    let editingTaskId = null;

    // Protection Recherche Tâches
    const searchTask = document.getElementById("task-search");
    if (searchTask) {
        searchTask.addEventListener("input", (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll(".task-card").forEach(card => {
                card.style.display = card.innerText.toLowerCase().includes(term) ? "block" : "none";
            });
        });
    }

    window.prepareEditTask = async (id) => {
        const doc = await tasksRef.doc(id).get();
        const d = doc.data();
        editingTaskId = id;
        document.getElementById('task-location').value = d.location || "";
        document.getElementById('task-name').value = d.name || "";
        document.getElementById('task-priority').value = d.priority || "Moyenne";
        document.getElementById('task-responsible').value = d.responsible || "";
        document.getElementById('task-date').value = d.date || "";
        document.getElementById('task-progress-percent').value = d.progress || 0;
        document.getElementById("task-form-container").classList.add("edit-mode-active");
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.deleteTask = async (id) => { if (confirm("Supprimer tâche ?")) await tasksRef.doc(id).delete(); };

    taskForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = {
            location: document.getElementById('task-location').value,
            name: document.getElementById('task-name').value,
            priority: document.getElementById('task-priority').value,
            responsible: document.getElementById('task-responsible').value,
            date: document.getElementById('task-date').value,
            progress: parseInt(document.getElementById('task-progress-percent').value) || 0,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        editingTaskId ? await tasksRef.doc(editingTaskId).update(data) : await tasksRef.add(data);
        e.target.reset();
        editingTaskId = null;
        document.getElementById("task-form-container").classList.remove("edit-mode-active");
    });

    tasksRef.orderBy("updatedAt", "desc").onSnapshot(snap => {
        const container = document.getElementById("tasks-container");
        if(!container) return;
        let completed = 0, total = snap.size, html = "";

        snap.forEach(doc => {
            const d = doc.data();
            if (d.progress === 100) completed++;
            const color = d.priority === "Bloquée" ? "#DC3545" : (d.priority === "Haute" ? "#fbbc04" : "#1A73E8");

            html += `
                <div class="expense-card task-card ${d.progress === 100 ? 'paid' : ''}" style="border-left: 5px solid ${color};">
                    <div style="display:flex; justify-content:space-between;">
                        <strong>${d.name}</strong>
                        <span>${d.progress}%</span>
                    </div>
                    <div style="font-size:0.8rem; margin:10px 0; color:#555;">
                        📍 Pièce: ${d.location} | 👷 Resp: ${d.responsible}<br>
                        📅 Échéance: ${d.date || 'Non définie'}
                    </div>
                    <div style="height:8px; background:#eee; border-radius:4px; overflow:hidden; margin-bottom:10px;">
                        <div style="width:${d.progress}%; height:100%; background:#28a745; transition: width 0.3s;"></div>
                    </div>
                    <div class="card-actions">
                        <button class="edit-btn" onclick="prepareEditTask('${doc.id}')">Modifier</button>
                        <button class="del-btn" onclick="deleteTask('${doc.id}')">Supprimer</button>
                    </div>
                </div>`;
        });
        container.innerHTML = html;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        const progressBar = document.getElementById("task-progress-bar");
        const progressText = document.getElementById("overall-task-progress");
        if(progressBar) progressBar.style.width = percent + "%";
        if(progressText) progressText.innerText = `${percent}% (${completed} / ${total} Tâches Terminées)`;
    });
}