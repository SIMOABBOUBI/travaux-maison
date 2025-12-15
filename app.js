// 🔥 Config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDtGiCjOy33ZI03QAe_ELIHfg9H05tVtK4",
  authDomain: "travaux-maison-9e170.firebaseapp.com",
  projectId: "travaux-maison-9e170",
  storageBucket: "travaux-maison-9e170.appspot.com",
  messagingSenderId: "34299316168",
  appId: "1:34299316168:web:d42197f3bdeb9d5759a2fd",
  measurementId: "G-7NVN7W9HXX"
};

// Initialisation Firebase (compat)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const expensesRef = db.collection("expenses");

// Ajouter une dépense
function addExpense() {
  if(!date.value || !category.value || !description.value || !amount.value) return alert("Remplis tous les champs !");

  expensesRef.add({
    date: date.value,
    type: type.value,
    category: category.value,
    description: description.value,
    amount: Number(amount.value)
  });

  // Reset formulaire
  date.value = '';
  category.value = '';
  description.value = '';
  amount.value = '';
}

// Afficher en temps réel
expensesRef.orderBy("date").onSnapshot(snapshot => {
  let html = "";
  let totals = { Outillage: 0, Prestations: 0, "Grosses dépenses": 0 };

  snapshot.forEach(doc => {
    const e = doc.data();
    totals[e.type] += e.amount;

    html += `
      <tr>
        <td>${e.date}</td>
        <td>${e.type}</td>
        <td>${e.category}</td>
        <td>${e.description}</td>
        <td>${e.amount} €</td>
        <td><button onclick="deleteExpense('${doc.id}')">X</button></td>
      </tr>`;
  });

  list.innerHTML = html;
  outillage.textContent = totals.Outillage + " €";
  prestations.textContent = totals.Prestations + " €";
  grosses.textContent = totals["Grosses dépenses"] + " €";
  total.textContent = (totals.Outillage + totals.Prestations + totals["Grosses dépenses"]) + " €";
});

// Supprimer une dépense
function deleteExpense(id) {
  if(confirm("Supprimer cette dépense ?")) {
    expensesRef.doc(id).delete();
  }
}
