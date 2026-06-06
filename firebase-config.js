const firebaseConfig = {
    apiKey: "AIzaSyD2Epz3HrLnXoPWPjX_SOe2-n2V71WBpsU",
    authDomain: "invidual-prod.firebaseapp.com",
    databaseURL: "https://invidual-prod-default-rtdb.firebaseio.com",
    projectId: "invidual-prod",
    storageBucket: "invidual-prod.firebasestorage.app",
    messagingSenderId: "703763555468",
    appId: "1:703763555468:web:0671cdd3e8e1d6915d07a9"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
