const loadButton = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const status = document.querySelector("#status");
const usersList = document.querySelector("#users-list");

const usersUrl = "https://jsonplaceholder.typicode.com/users";
let users = [];
let hasLoadedUsers = false;

function renderUsers(list) {
  usersList.replaceChildren();

  list.forEach((user) => {
    const item = document.createElement("li");
    const name = document.createElement("h2");
    const email = document.createElement("p");
    const city = document.createElement("p");
    const company = document.createElement("p");

    name.textContent = user.name;
    email.textContent = `Email: ${user.email}`;
    city.textContent = `City: ${user.address.city}`;
    company.textContent = `Company: ${user.company.name}`;

    item.append(name, email, city, company);
    usersList.append(item);
  });
}

function filterUsers() {
  const query = filterInput.value.trim().toLowerCase();
  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(query)
  );

  renderUsers(filteredUsers);

  if (filteredUsers.length === 0) {
    status.textContent = "No users match your filter.";
  } else if (query) {
    status.textContent = `Showing ${filteredUsers.length} of ${users.length} users.`;
  } else {
    status.textContent = `Loaded ${users.length} users.`;
  }
}

async function loadUsers() {
  loadButton.disabled = true;
  status.textContent = "Loading users...";

  try {
    const response = await fetch(usersUrl);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}.`);
    }

    const loadedUsers = await response.json();
    if (!Array.isArray(loadedUsers)) {
      throw new Error("The users response was not a list.");
    }

    users = loadedUsers;
    hasLoadedUsers = true;
    filterUsers();
  } catch (error) {
    status.textContent = "Unable to load users. Please try again.";
    console.error("Unable to load users:", error);
  } finally {
    loadButton.disabled = false;
  }
}

loadButton.addEventListener("click", loadUsers);
filterInput.addEventListener("input", () => {
  if (hasLoadedUsers) {
    filterUsers();
  }
});
