const recipeGrid = document.getElementById('recipe-grid');
const addRecipeBtn = document.getElementById('add-recipe-btn');
const searchBar = document.getElementById('search-bar');
const recipeFormModal = document.getElementById('recipe-form-modal');
const recipeDetailModal = document.getElementById('recipe-detail-modal');
const confirmDeleteModal = document.getElementById('confirm-delete-modal');
const notificationToast = document.getElementById('notification-toast');
const recipeForm = document.getElementById('recipe-form');
const ingredientForm = document.getElementById('ingredient-form');
const tipForm = document.getElementById('tip-form');

let db;
let currentRecipeId = null;

// --- Main Initialization Function ---
async function main() {
    const config = { locateFile: filename => `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${filename}` };
    const SQL = await initSqlJs(config);
    const savedDb = localStorage.getItem('recipe_db');
    if (savedDb) {
        db = new SQL.Database(savedDb.split(',').map(Number));
    } else {
        db = new SQL.Database();
        const query = `
            CREATE TABLE recipes (id INTEGER PRIMARY KEY, title TEXT, instructions TEXT, cook_time INTEGER, image_url TEXT);
            CREATE TABLE ingredients (id INTEGER PRIMARY KEY, recipe_id INTEGER, name TEXT, quantity TEXT, FOREIGN KEY (recipe_id) REFERENCES recipes(id));
        `;
        db.run(query);
    }
    const tipsTableCheck = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='tips';");
    if (tipsTableCheck.length === 0) {
        db.run("CREATE TABLE tips (id INTEGER PRIMARY KEY, recipe_id INTEGER, tip_text TEXT, FOREIGN KEY (recipe_id) REFERENCES recipes(id));");
    }
    saveDatabase();
    setupEventListeners();
    renderAllRecipes();
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    addRecipeBtn.addEventListener('click', () => {
        recipeForm.reset();
        document.getElementById('form-title').innerText = 'Add New Recipe';
        recipeFormModal.classList.remove('hidden');
    });

    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.modal-overlay').classList.add('hidden'));
    });

    searchBar.addEventListener('input', (e) => renderAllRecipes(e.target.value));
    
    document.getElementById('delete-recipe-btn').addEventListener('click', () => {
        if (currentRecipeId) {
            confirmDeleteModal.classList.remove('hidden');
        }
    });

    document.getElementById('cancel-delete-btn').addEventListener('click', () => {
        confirmDeleteModal.classList.add('hidden');
    });
    document.getElementById('confirm-delete-btn').addEventListener('click', executeDelete);

    recipeForm.addEventListener('submit', handleRecipeFormSubmit);
    ingredientForm.addEventListener('submit', handleIngredientSubmit);
    tipForm.addEventListener('submit', handleTipSubmit);
    document.getElementById('edit-instructions-btn').addEventListener('click', toggleInstructionsEdit);
    document.getElementById('save-instructions-btn').addEventListener('click', saveInstructions);
}

// --- Notification Logic ---
function showNotification(message) {
    notificationToast.textContent = message;
    notificationToast.classList.add('show');
    setTimeout(() => {
        notificationToast.classList.remove('show');
    }, 3000);
}

// --- Deletion Logic ---
function executeDelete() {
    if (!currentRecipeId) return;
    db.run("DELETE FROM ingredients WHERE recipe_id = ?", [currentRecipeId]);
    db.run("DELETE FROM tips WHERE recipe_id = ?", [currentRecipeId]);
    db.run("DELETE FROM recipes WHERE id = ?", [currentRecipeId]);
    saveDatabase();
    recipeDetailModal.classList.add('hidden');
    confirmDeleteModal.classList.add('hidden');
    renderAllRecipes();
    showNotification('Recipe deleted successfully!');
}

// --- Database & Rendering ---
function saveDatabase() { localStorage.setItem('recipe_db', db.export()); }

function renderAllRecipes(searchTerm = '') {
    recipeGrid.innerHTML = '';
    let query = "SELECT * FROM recipes";
    const params = [];
    if (searchTerm.trim() !== '') {
        query += " WHERE title LIKE ?";
        params.push(`%${searchTerm}%`);
    }
    query += " ORDER BY id DESC";
    const recipes = db.exec(query, params);
    if (recipes.length > 0 && recipes[0].values.length > 0) {
        recipes[0].values.forEach(recipeData => {
            const [id, title, instructions, cook_time, image_url] = recipeData;
            const card = document.createElement('div');
            card.className = 'recipe-card';
            const displayImage = image_url || 'https://via.placeholder.com/400x250.png/ff7e5f/ffffff?text=Recipe';
            card.innerHTML = `<img src="${displayImage}" alt="${title}"><div class="recipe-card-content"><h3>${title}</h3><p>${cook_time} mins</p></div>`;
            card.addEventListener('click', () => showRecipeDetail(id));
            recipeGrid.appendChild(card);
        });
    } else {
        recipeGrid.innerHTML = '<p style="color: white; text-align: center; grid-column: 1 / -1;">No recipes found. Try a different search or add a new recipe!</p>';
    }
}

// --- Detail View Logic ---
function showRecipeDetail(recipeId) {
    currentRecipeId = recipeId;
    const recipeResult = db.exec("SELECT * FROM recipes WHERE id = ?", [currentRecipeId]);
    if (!recipeResult.length) return;
    const recipe = recipeResult[0].values[0];
    const [id, title, instructions, cook_time, image_url] = recipe;

    document.getElementById('detail-title').innerText = title;
    document.getElementById('detail-image').src = image_url || 'https://via.placeholder.com/400x250.png/ff7e5f/ffffff?text=Recipe';
    document.getElementById('detail-cook-time').innerText = cook_time;
    document.getElementById('instructions-display').innerText = instructions;
    document.getElementById('instructions-textarea').value = instructions;
    
    const ingredientsList = document.getElementById('detail-ingredients-list');
    ingredientsList.innerHTML = '';
    const ingredients = db.exec("SELECT id, name, quantity FROM ingredients WHERE recipe_id = ?", [currentRecipeId]);
    if (ingredients.length > 0) {
        ingredients[0].values.forEach(([id, name, quantity]) => {
            ingredientsList.innerHTML += `<li><span>${name}</span><span>${quantity}</span></li>`;
        });
    }

    const tipsList = document.getElementById('detail-tips-list');
    tipsList.innerHTML = '';
    const tips = db.exec("SELECT id, tip_text FROM tips WHERE recipe_id = ?", [currentRecipeId]);
    if (tips.length > 0) {
        tips[0].values.forEach(([id, tip_text]) => {
            tipsList.innerHTML += `<li>${tip_text}</li>`;
        });
    }
    
    document.getElementById('instructions-display').classList.remove('hidden');
    document.getElementById('instructions-edit').classList.add('hidden');
    recipeDetailModal.classList.remove('hidden');
}

// --- Form Handlers ---
function handleRecipeFormSubmit(event) {
    event.preventDefault();
    const recipeData = {
        title: document.getElementById('title').value,
        cook_time: document.getElementById('cook-time').value,
        image_url: document.getElementById('image-url').value,
        instructions: document.getElementById('instructions').value
    };
    db.run("INSERT INTO recipes (title, instructions, cook_time, image_url) VALUES (?, ?, ?, ?)", [recipeData.title, recipeData.instructions, recipeData.cook_time, recipeData.image_url]);
    saveDatabase();
    renderAllRecipes();
    recipeFormModal.classList.add('hidden');
}

function handleIngredientSubmit(event) {
    event.preventDefault();
    const nameInput = document.getElementById('ingredient-name');
    const quantityInput = document.getElementById('ingredient-quantity');
    db.run("INSERT INTO ingredients (recipe_id, name, quantity) VALUES (?, ?, ?)", [currentRecipeId, nameInput.value, quantityInput.value]);
    saveDatabase();
    nameInput.value = '';
    quantityInput.value = '';
    showRecipeDetail(currentRecipeId);
}

function handleTipSubmit(event) {
    event.preventDefault();
    const tipInput = document.getElementById('tip-text');
    db.run("INSERT INTO tips (recipe_id, tip_text) VALUES (?, ?)", [currentRecipeId, tipInput.value]);
    saveDatabase();
    tipInput.value = '';
    showRecipeDetail(currentRecipeId);
}

// --- Instructions Edit Logic ---
function toggleInstructionsEdit() {
    document.getElementById('instructions-display').classList.toggle('hidden');
    document.getElementById('instructions-edit').classList.toggle('hidden');
}

function saveInstructions() {
    const newInstructions = document.getElementById('instructions-textarea').value;
    db.run("UPDATE recipes SET instructions = ? WHERE id = ?", [newInstructions, currentRecipeId]);
    saveDatabase();
    toggleInstructionsEdit();
    document.getElementById('instructions-display').innerText = newInstructions;
}

main();