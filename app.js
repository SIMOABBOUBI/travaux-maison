// 🔥 Firebase
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

// DOM elements
const date = document.getElementById("date");
const type = document.getElementById("type");
const category = document.getElementById("category");
const description = document.getElementById("description");
const recipient = document.getElementById("recipient");
const amount = document.getElementById("amount");
const status = document.getElementById("status");
const dueDate = document.getElementById("dueDate");

const outillage = document.getElementById("outillage");
const prestations = document.getElementById("prestations");
const grosses = document.getElementById("grosses");
const total = document.getElementById("total");
const cardsContainer = document.getElementById("cards-container");

// Ajouter dépense
function addExpense() {
  if (!date.value || !category.value || !description.value || !amount.value || !recipient.value || !status.value) {
    return alert("Remplis tous les champs !");
  }

  expensesRef.add({
    date: date.value,
    type: type.value,
    category: category.value,
    description: description.value,
    recipient: recipient.value,
    amount: Number(amount.value),
    status: status.value,
    dueDate: dueDate.value || '',
    postponed: false
  });

  date.value = '';
  category.value = '';
  description.value = '';
  recipient.value = '';
  amount.value = '';
  status.value = 'Acompte';
  dueDate.value = '';
}

// Temps réel
expensesRef.orderBy("date").onSnapshot(snapshot => {
  let totals = { Outillage: 0, Prestations: 0, "Grosses dépenses": 0 };
  const today = new Date().toISOString().split('T')[0];
  cardsContainer.innerHTML = '';

  snapshot.forEach(doc => {
    const e = doc.data();
    totals[e.type] += e.amount;

    const overdueClass = (e.dueDate && e.dueDate < today && e.status !== "Payé") ? "overdue" : "";

    const card = document.createElement("div");
    card.className = "expense-card " + overdueClass;

    card.innerHTML = `
      <div class="expense-header">
        <span>${e.type} - ${e.category}</span>
        <span>${e.amount} €</span>
      </div>
      <div>Description: ${e.description}</div>
      <div>Bénéficiaire: ${e.recipient}</div>
      <div>Status: ${e.status}</div>
      <div>Échéance: ${e.dueDate || '-'}</div>
      <div class="expense-actions">
        <button class="delete" onclick="deleteExpense('${doc.id}')"><i class="fas fa-trash"></i></button>
        <button class="postpone" onclick="postponeExpense('${doc.id}')"><i class="fas fa-clock"></i></button>
      </div>
    `;
    cardsContainer.appendChild(card);
  });

  outillage.textContent = totals.Outillage + " €";
  prestations.textContent = totals.Prestations + " €";
  grosses.textContent = totals["Grosses dépenses"] + " €";
  total.textContent = (totals.Outillage + totals.Prestations + totals["Grosses dépenses"]) + " €";
});

// Supprimer
function deleteExpense(id) {
  if(confirm("Supprimer cette dépense ?")){
    expensesRef.doc(id).delete();
  }
}

// Remettre à plus tard
function postponeExpense(id) {
  const newDate = prompt("Nouvelle date d'échéance ? (YYYY-MM-DD)");
  if(newDate){
    expensesRef.doc(id).update({ dueDate: newDate, postponed: true });
  }
}
