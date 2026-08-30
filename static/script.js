/* ============================================================
   PERSONAL EXPENSE TRACKER
   script.js
============================================================ */

"use strict";


/* ============================================================
   GLOBAL VARIABLES
============================================================ */

let allExpenses = [];

let categoryChart = null;

let yearChart = null;

let expenseToDelete = null;

let toastTimer = null;


/* ============================================================
   ACTION LOADING INDICATORS
   Different visual loaders for Add / Edit / Delete / Save.
============================================================ */

function getSubmitButton(form) {
    if (!form) return null;
    return form.querySelector(
        'button[type="submit"], input[type="submit"]'
    );
}

function setActionLoading(button, type = "default", text = "Working...") {
    if (!button || button.dataset.loading === "true") return;

    button.dataset.loading = "true";
    button.dataset.originalHtml = button.innerHTML;
    button.dataset.originalDisabled = button.disabled ? "true" : "false";
    button.disabled = true;
    button.classList.add("action-loading", `action-loading-${type}`);

    const loaders = {
        add: `
            <span class="loader loader-add" aria-hidden="true">
                <span></span><span></span><span></span>
            </span>
            <span>${text}</span>
        `,
        edit: `
            <span class="loader loader-edit" aria-hidden="true">
                <span></span><span></span><span></span>
            </span>
            <span>${text}</span>
        `,
        delete: `
            <span class="loader loader-delete" aria-hidden="true">
                <span></span>
            </span>
            <span>${text}</span>
        `,
        save: `
            <span class="loader loader-save" aria-hidden="true"></span>
            <span>${text}</span>
        `,
        default: `
            <span class="loader loader-default" aria-hidden="true"></span>
            <span>${text}</span>
        `
    };

    button.innerHTML = loaders[type] || loaders.default;
    button.setAttribute("aria-busy", "true");
}

function stopActionLoading(button) {
    if (!button || button.dataset.loading !== "true") return;

    button.innerHTML =
        button.dataset.originalHtml || button.innerHTML;

    button.disabled =
        button.dataset.originalDisabled === "true";

    button.classList.remove(
        "action-loading",
        "action-loading-add",
        "action-loading-edit",
        "action-loading-delete",
        "action-loading-save"
    );

    button.removeAttribute("aria-busy");

    delete button.dataset.loading;
    delete button.dataset.originalHtml;
    delete button.dataset.originalDisabled;
}

function setDeleteIconLoading(button) {
    if (!button || button.dataset.loading === "true") return;

    button.dataset.loading = "true";
    button.dataset.originalHtml = button.innerHTML;
    button.dataset.originalDisabled =
        button.disabled ? "true" : "false";

    button.disabled = true;
    button.classList.add("action-loading", "action-loading-delete");
    button.innerHTML = `
        <span class="loader loader-trash" aria-hidden="true">
            <span></span>
        </span>
    `;
    button.setAttribute("aria-busy", "true");
}


/* ============================================================
   APP LOADING INDICATOR
   Shows a visible loading screen while the initial API requests
   are loading, so the page never looks stuck.
============================================================ */

let appLoadingOverlay = null;

function createAppLoadingOverlay() {

    if (appLoadingOverlay) {
        return;
    }

    const style = document.createElement("style");
    style.id = "app-loading-style";
    style.textContent = `
        #appLoadingOverlay {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(248, 250, 255, 0.94);
            backdrop-filter: blur(4px);
            opacity: 1;
            visibility: visible;
            transition: opacity 0.2s ease, visibility 0.2s ease;
        }

        #appLoadingOverlay.hidden {
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
        }

        .app-loading-card {
            min-width: 220px;
            padding: 28px 30px;
            border-radius: 18px;
            background: #ffffff;
            box-shadow: 0 16px 50px rgba(31, 41, 55, 0.16);
            text-align: center;
        }

        .app-loading-spinner {
            width: 42px;
            height: 42px;
            margin: 0 auto 16px;
            border: 4px solid #e9d5ff;
            border-top-color: #7c3cff;
            border-radius: 50%;
            animation: appLoadingSpin 0.8s linear infinite;
        }

        .app-loading-title {
            margin: 0;
            color: #172554;
            font-size: 16px;
            font-weight: 700;
        }

        .app-loading-text {
            margin: 6px 0 0;
            color: #64748b;
            font-size: 13px;
        }

        @keyframes appLoadingSpin {
            to { transform: rotate(360deg); }
        }
    `;

    document.head.appendChild(style);

    appLoadingOverlay = document.createElement("div");
    appLoadingOverlay.id = "appLoadingOverlay";
    appLoadingOverlay.innerHTML = `
        <div class="app-loading-card" role="status" aria-live="polite">
            <div class="app-loading-spinner" aria-hidden="true"></div>
            <p class="app-loading-title">Loading your expense tracker</p>
            <p class="app-loading-text">Please wait while your data is loaded...</p>
        </div>
    `;

    document.body.appendChild(appLoadingOverlay);
}

function showAppLoading() {
    createAppLoadingOverlay();
    if (appLoadingOverlay) {
        appLoadingOverlay.classList.remove("hidden");
    }
}

function hideAppLoading() {
    if (appLoadingOverlay) {
        appLoadingOverlay.classList.add("hidden");
    }
}



/* ============================================================
   CATEGORY COLORS
   Keep chart and legend colors synchronized.
============================================================ */

const CATEGORY_COLORS = {

    "Food": "#8b5cf6",

    "Transport": "#3b82f6",

    "Education": "#10b981",

    "Shopping": "#f59e0b",

    "Entertainment": "#ec4899",

    "Bills": "#ef4444",

    "Health": "#06b6d4",

    "Travel": "#f97316",

    "Other": "#64748b"

};


/* ============================================================
   CATEGORY ICONS
============================================================ */

const CATEGORY_ICONS = {

    "Food":
        "fa-utensils",

    "Transport":
        "fa-bus",

    "Education":
        "fa-graduation-cap",

    "Shopping":
        "fa-bag-shopping",

    "Entertainment":
        "fa-film",

    "Bills":
        "fa-file-invoice",

    "Health":
        "fa-heart-pulse",

    "Travel":
        "fa-plane",

    "Other":
        "fa-tag"

};


/* ============================================================
   DOM READY
============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        initializeApplication();

    }
);


/* ============================================================
   INITIALIZE APPLICATION
============================================================ */

async function initializeApplication() {

    showAppLoading();

    setupNavigation();

    setupDashboardButtons();

    setupAddExpenseForm();

    setupYearSemester();

    setupCategoryOtherInput();

    setupExpenseFilters();

    setupEditModal();

    setupDeleteModal();

    setupGlobalSearch();

    setupTheme();

    setupHeaderButtons();

    setupBackup();

    setupCategoryPage();

    setupAcademicPage();

    setupDateInputs();

    try {

        await Promise.all([
            loadExpenses(),
            loadDashboard(),
            loadSavings()
        ]);

        loadSettings();

    } finally {

        hideAppLoading();

    }

}


/* ============================================================
   NAVIGATION
============================================================ */

function setupNavigation() {

    const navItems = document.querySelectorAll(".nav-item");
    const sidebar = document.querySelector(".sidebar");
    const menuToggle = document.getElementById("menuToggle");
    const overlay = document.getElementById("sidebarOverlay");

    function closeMobileSidebar() {
        if (sidebar) sidebar.classList.remove("mobile-open");
        if (overlay) overlay.classList.remove("show");
        document.body.style.overflow = "";
        if (menuToggle) menuToggle.setAttribute("aria-label", "Open menu");
    }

    function toggleMobileSidebar() {
        if (!sidebar) return;
        const isOpen = sidebar.classList.toggle("mobile-open");
        if (overlay) overlay.classList.toggle("show", isOpen);
        document.body.style.overflow = isOpen ? "hidden" : "";
        if (menuToggle) menuToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
    }

    if (menuToggle) {
        menuToggle.addEventListener("click", toggleMobileSidebar);
    }

    if (overlay) {
        overlay.addEventListener("click", closeMobileSidebar);
    }

    navItems.forEach(function (item) {
        item.addEventListener("click", function () {
            const page = item.dataset.page;
            if (!page) return;
            showPage(page);
            closeMobileSidebar();
        });
    });

    window.addEventListener("resize", function () {
        if (window.innerWidth > 750) closeMobileSidebar();
    });

}


function showPage(pageName) {

    const pages =
        document.querySelectorAll(
            ".page"
        );


    pages.forEach(
        function (page) {

            page.classList.remove(
                "active"
            );

        }
    );


    const targetPage =
        document.getElementById(
            "page-" + pageName
        );


    if (targetPage) {

        targetPage.classList.add(
            "active"
        );

    }


    const navItems =
        document.querySelectorAll(
            ".nav-item"
        );


    navItems.forEach(
        function (item) {

            item.classList.remove(
                "active"
            );


            if (
                item.dataset.page ===
                pageName
            ) {

                item.classList.add(
                    "active"
                );

            }

        }
    );


    if (pageName === "dashboard") {

        loadDashboard();

    }
    if (pageName === "expenses") {

        renderExpenses();

    }


    if (pageName === "categories") {

        renderCategoryPage();

    }


    if (pageName === "academic") {

        renderAcademic();

    }

    if (pageName === "savings") {

        loadSavings();

    }

    if (pageName === "backup") {

        updateBackupInformation();

    }


    if (pageName === "settings") {

        updateSettingsInformation();

    }


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


/* ============================================================
   DASHBOARD BUTTONS
============================================================ */

function setupDashboardButtons() {

    const addButton =
        document.getElementById(
            "goAddExpense"
        );


    if (addButton) {

        addButton.addEventListener(
            "click",
            function () {

                showPage(
                    "add-expense"
                );

            }
        );

    }


    const categoryAddButton =
        document.getElementById(
            "categoryAddExpense"
        );


    if (categoryAddButton) {

        categoryAddButton.addEventListener(
            "click",
            function () {

                showPage(
                    "add-expense"
                );

            }
        );

    }


    const cancelButton =
        document.getElementById(
            "cancelExpense"
        );


    if (cancelButton) {

        cancelButton.addEventListener(
            "click",
            function () {

                resetExpenseForm();

                showPage(
                    "dashboard"
                );

            }
        );

    }

}


/* ============================================================
   LOAD EXPENSES
============================================================ */

async function loadExpenses() {

    try {

        const response =
            await fetch(
                "/api/expenses"
            );


        if (!response.ok) {

            throw new Error(
                "Could not load expenses."
            );

        }


        const data =
            await response.json();


        if (!Array.isArray(data)) {

            throw new Error(
                data.error ||
                "Invalid expense data."
            );

        }


        allExpenses = data;


        renderExpenses();

        renderCategoryPage();

        renderAcademicPage();

        updateBackupInformation();

        updateSettingsInformation();


    } catch (error) {

        console.error(
            "LOAD EXPENSES ERROR:",
            error
        );


        showToast(
            "Unable to load expense data.",
            "error"
        );

    }

}


/* ============================================================
   FORMAT CURRENCY
============================================================ */

function formatCurrency(amount) {

    const number =
        Number(amount) || 0;


    return number.toLocaleString(
        "en-IN",
        {
            style: "currency",
            currency: "INR",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    );

}

function setText(id, value) {

    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}


function formatRupees(amount) {
    return formatCurrency(amount);
}


function escapeHtml(value) {
    return escapeHTML(value);
}


function isValidDateFormat(value) {

    if (!value) {
        return false;
    }

    const parts = String(value).trim().split("-");

    if (parts.length !== 3) {
        return false;
    }

    const day = Number(parts[0]);
    const month = Number(parts[1]);
    const year = Number(parts[2]);

    if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
        return false;
    }

    const date = new Date(year, month - 1, day);

    return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
    );
}



/* ============================================================
   FORMAT DATE FOR DISPLAY
============================================================ */

function formatDisplayDate(dateValue) {

    if (!dateValue) {
        return "";
    }


    const text =
        String(dateValue).trim();


    /*
       Backend normally sends:
       YYYY-MM-DD
    */

    const parts =
        text.split("-");


    if (
        parts.length === 3 &&
        parts[0].length === 4
    ) {

        return (
            parts[2] +
            "-" +
            parts[1] +
            "-" +
            parts[0]
        );

    }


    return text;

}


/* ============================================================
   DATE INPUT
============================================================ */

function setupDateInputs() {

    const inputs = [
        document.getElementById("expenseDate"),
        document.getElementById("editDate"),
        document.getElementById("savingsTargetDate"),
        document.getElementById("savingsDate")
    ];


    inputs.forEach(
        function (input) {

            if (!input) {
                return;
            }


            input.addEventListener(
                "input",
                function () {

                    let value =
                        input.value.replace(
                            /\D/g,
                            ""
                        );


                    if (value.length > 8) {

                        value =
                            value.substring(
                                0,
                                8
                            );

                    }


                    if (value.length > 4) {

                        value =
                            value.substring(
                                0,
                                2
                            ) +
                            "-" +
                            value.substring(
                                2,
                                4
                            ) +
                            "-" +
                            value.substring(
                                4
                            );

                    } else if (
                        value.length > 2
                    ) {

                        value =
                            value.substring(
                                0,
                                2
                            ) +
                            "-" +
                            value.substring(
                                2
                            );

                    }


                    input.value =
                        value;

                }
            );

        }
    );

}


/* ============================================================
   CONVERT DD-MM-YYYY TO YYYY-MM-DD
============================================================ */

function convertDateForBackend(
    value
) {

    if (!value) {
        return "";
    }


    const parts =
        value.split("-");


    if (
        parts.length !== 3
    ) {

        return "";

    }


    const day =
        parts[0];

    const month =
        parts[1];

    const year =
        parts[2];


    if (
        day.length !== 2 ||
        month.length !== 2 ||
        year.length !== 4
    ) {

        return "";

    }


    return (
        year +
        "-" +
        month +
        "-" +
        day
    );

}


/* ============================================================
   VALIDATE DATE
============================================================ */

function isValidDate(
    value
) {

    const backendDate =
        convertDateForBackend(
            value
        );


    if (!backendDate) {
        return false;
    }


    const parts =
        backendDate.split("-");


    const year =
        Number(parts[0]);

    const month =
        Number(parts[1]);

    const day =
        Number(parts[2]);


    const date =
        new Date(
            year,
            month - 1,
            day
        );


    return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
    );

}


/* ============================================================
   YEAR → SEMESTER
============================================================ */

function setupYearSemester() {

    const yearSelect =
        document.getElementById(
            "academicYear"
        );


    const semesterSelect =
        document.getElementById(
            "semester"
        );


    if (
        !yearSelect ||
        !semesterSelect
    ) {

        return;

    }


    yearSelect.addEventListener(
        "change",
        function () {

            updateSemesterOptions(
                yearSelect.value,
                semesterSelect
            );

        }
    );

}


function updateSemesterOptions(
    academicYear,
    semesterSelect,
    selectedSemester = ""
) {

    if (!semesterSelect) {
        return;
    }


    semesterSelect.innerHTML = "";


    const firstOption =
        document.createElement(
            "option"
        );


    firstOption.value = "";

    firstOption.textContent =
        "Select Semester";


    semesterSelect.appendChild(
        firstOption
    );


    const semesterMap = {

        "1st Year": [
            "1st Sem",
            "2nd Sem"
        ],

        "2nd Year": [
            "3rd Sem",
            "4th Sem"
        ],

        "3rd Year": [
            "5th Sem",
            "6th Sem"
        ],

        "4th Year": [
            "7th Sem",
            "8th Sem"
        ]

    };


    const semesters =
        semesterMap[
        academicYear
        ] || [];


    semesters.forEach(
        function (semester) {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                semester;

            option.textContent =
                semester;


            if (
                semester ===
                selectedSemester
            ) {

                option.selected =
                    true;

            }


            semesterSelect.appendChild(
                option
            );

        }
    );

}


/* ============================================================
   OTHER CATEGORY
============================================================ */

function setupCategoryOtherInput() {

    const category =
        document.getElementById(
            "expenseCategory"
        );


    const otherGroup =
        document.getElementById(
            "otherCategoryGroup"
        );


    const otherInput =
        document.getElementById(
            "otherCategory"
        );


    if (
        !category ||
        !otherGroup ||
        !otherInput
    ) {

        return;

    }


    category.addEventListener(
        "change",
        function () {

            if (
                category.value ===
                "Other"
            ) {

                otherGroup.classList.remove(
                    "hidden"
                );

                otherInput.required =
                    true;

                otherInput.focus();

            } else {

                otherGroup.classList.add(
                    "hidden"
                );

                otherInput.required =
                    false;

                otherInput.value =
                    "";

            }

        }
    );

}


/* ============================================================
   ADD EXPENSE FORM
============================================================ */

function setupAddExpenseForm() {

    const form =
        document.getElementById(
            "expenseForm"
        );


    if (!form) {
        return;
    }


    form.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const year =
                document.getElementById(
                    "academicYear"
                ).value;


            const semester =
                document.getElementById(
                    "semester"
                ).value;


            const dateInput =
                document.getElementById(
                    "expenseDate"
                );


            const date =
                dateInput.value.trim();


            const categorySelect =
                document.getElementById(
                    "expenseCategory"
                );


            let category =
                categorySelect.value;


            const otherCategory =
                document.getElementById(
                    "otherCategory"
                );


            if (
                category === "Other"
            ) {

                category =
                    otherCategory.value.trim();


                if (!category) {

                    showToast(
                        "Please enter the category.",
                        "error"
                    );

                    otherCategory.focus();

                    return;

                }

            }


            const amount =
                document.getElementById(
                    "expenseAmount"
                ).value;


            const paymentMethod =
                document.getElementById(
                    "paymentMethod"
                ).value;


            const description =
                document.getElementById(
                    "expenseDescription"
                ).value.trim();


            /* -----------------------------------------------
               VALIDATION
            ------------------------------------------------ */

            if (!year) {

                showToast(
                    "Please select an academic year.",
                    "error"
                );

                return;

            }


            if (!semester) {

                showToast(
                    "Please select a semester.",
                    "error"
                );

                return;

            }


            if (!isValidDate(date)) {

                showToast(
                    "Enter a valid date as DD-MM-YYYY.",
                    "error"
                );

                dateInput.focus();

                return;

            }


            if (!category) {

                showToast(
                    "Please select a category.",
                    "error"
                );

                return;

            }


            if (
                amount === "" ||
                Number(amount) < 0
            ) {

                showToast(
                    "Please enter a valid amount.",
                    "error"
                );

                return;

            }


            if (!paymentMethod) {

                showToast(
                    "Please select a payment method.",
                    "error"
                );

                return;

            }


            /* -----------------------------------------------
               SEND TO FLASK
            ------------------------------------------------ */

            const payload = {

                academic_year:
                    year,

                semester:
                    semester,

                date:
                    convertDateForBackend(
                        date
                    ),

                category:
                    category,

                amount:
                    Number(amount),

                payment_method:
                    paymentMethod,

                description:
                    description

            };


            const submitButton = getSubmitButton(form);
            setActionLoading(submitButton, "add", "Adding...");


            try {

                const response =
                    await fetch(
                        "/api/expenses",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify(
                                    payload
                                )
                        }
                    );


                const result =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        result.error ||
                        "Could not add expense."
                    );

                }


                showToast(
                    "Expense added successfully.",
                    "success"
                );


                resetExpenseForm();


                await loadExpenses();

                await loadDashboard();

                showPage(
                    "expenses"
                );


            } catch (error) {

                console.error(
                    "ADD ERROR:",
                    error
                );


                showToast(
                    error.message,
                    "error"
                );

            } finally {

                stopActionLoading(submitButton);

            }

        }
    );

}


/* ============================================================
   RESET ADD FORM
============================================================ */

function resetExpenseForm() {

    const form =
        document.getElementById(
            "expenseForm"
        );


    if (form) {

        form.reset();

    }


    const semester =
        document.getElementById(
            "semester"
        );


    if (semester) {

        semester.innerHTML = "";


        const option =
            document.createElement(
                "option"
            );


        option.value = "";

        option.textContent =
            "Select Semester";


        semester.appendChild(
            option
        );

    }


    const otherGroup =
        document.getElementById(
            "otherCategoryGroup"
        );


    if (otherGroup) {

        otherGroup.classList.add(
            "hidden"
        );

    }


    const otherInput =
        document.getElementById(
            "otherCategory"
        );


    if (otherInput) {

        otherInput.required =
            false;

        otherInput.value =
            "";

    }

}


/* ============================================================
   ALL EXPENSES FILTERS
============================================================ */

function setupExpenseFilters() {

    const search =
        document.getElementById(
            "expenseSearch"
        );


    const year =
        document.getElementById(
            "expenseYearFilter"
        );


    const semester =
        document.getElementById(
            "expenseSemesterFilter"
        );


    const category =
        document.getElementById(
            "expenseCategoryFilter"
        );


    const clear =
        document.getElementById(
            "clearFilters"
        );


    [
        search,
        year,
        semester,
        category
    ].forEach(
        function (element) {

            if (!element) {
                return;
            }


            element.addEventListener(
                "input",
                renderExpenses
            );


            element.addEventListener(
                "change",
                renderExpenses
            );

        }
    );


    if (clear) {

        clear.addEventListener(
            "click",
            function () {

                if (search) {
                    search.value = "";
                }

                if (year) {
                    year.value = "";
                }

                if (semester) {
                    semester.value = "";
                }

                if (category) {
                    category.value = "";
                }


                renderExpenses();

            }
        );

    }

}


/* ============================================================
   FILTERED EXPENSES
============================================================ */

function getFilteredExpenses() {

    const searchElement =
        document.getElementById(
            "expenseSearch"
        );


    const yearElement =
        document.getElementById(
            "expenseYearFilter"
        );


    const semesterElement =
        document.getElementById(
            "expenseSemesterFilter"
        );


    const categoryElement =
        document.getElementById(
            "expenseCategoryFilter"
        );


    const search =
        searchElement
            ? searchElement.value
                .trim()
                .toLowerCase()
            : "";


    const year =
        yearElement
            ? yearElement.value
            : "";


    const semester =
        semesterElement
            ? semesterElement.value
            : "";


    const category =
        categoryElement
            ? categoryElement.value
            : "";


    return allExpenses.filter(
        function (expense) {

            const searchableText = [

                expense.id,

                expense.academic_year,

                expense.semester,

                expense.date,

                formatDisplayDate(
                    expense.date
                ),

                expense.category,

                expense.amount,

                expense.payment_method,

                expense.description

            ]
                .join(" ")
                .toLowerCase();


            const matchesSearch =
                !search ||
                searchableText.includes(
                    search
                );


            const matchesYear =
                !year ||
                expense.academic_year ===
                year;


            const matchesSemester =
                !semester ||
                expense.semester ===
                semester;


            const matchesCategory =
                !category ||
                expense.category ===
                category;


            return (
                matchesSearch &&
                matchesYear &&
                matchesSemester &&
                matchesCategory
            );

        }
    );

}


/* ============================================================
   RENDER ALL EXPENSES
============================================================ */

function renderExpenses() {

    const tbody =
        document.getElementById(
            "expenseTableBody"
        );


    const count =
        document.getElementById(
            "expenseRecordCount"
        );


    if (!tbody) {
        return;
    }


    const expenses =
        getFilteredExpenses();


    if (count) {

        count.textContent =
            expenses.length;

    }


    tbody.innerHTML = "";


    if (expenses.length === 0) {

        const row =
            document.createElement(
                "tr"
            );


        const cell =
            document.createElement(
                "td"
            );


        cell.colSpan = 9;

        cell.className =
            "empty-table";


        if (allExpenses.length === 0) {

            cell.textContent =
                "No expenses found. Add your first expense.";

        } else {

            cell.textContent =
                "No expenses match your filters.";

        }


        row.appendChild(
            cell
        );

        tbody.appendChild(
            row
        );

        return;

    }


    /*
       Newest ID first.
    */

    expenses
        .slice()
        .sort(
            function (a, b) {
                return b.id - a.id;
            }
        )
        .forEach(
            function (expense) {

                const row =
                    document.createElement(
                        "tr"
                    );


                row.innerHTML = `

                    <td>
                        ${escapeHTML(
                    expense.id
                )}
                    </td>

                    <td>
                        ${escapeHTML(
                    expense.academic_year
                )}
                    </td>

                    <td>
                        ${escapeHTML(
                    expense.semester
                )}
                    </td>

                    <td>
                        ${escapeHTML(
                    formatDisplayDate(
                        expense.date
                    )
                )}
                    </td>

                    <td>
                        <span class="category-badge">
                            ${escapeHTML(
                    expense.category
                )}
                        </span>
                    </td>

                    <td class="amount-cell">
                        ${formatCurrency(
                    expense.amount
                )}
                    </td>

                    <td>
                        ${escapeHTML(
                    expense.payment_method
                )}
                    </td>

                    <td>
                        ${escapeHTML(
                    expense.description ||
                    "-"
                )}
                    </td>

                    <td>

                        <div class="action-buttons">

                            <button
                                type="button"
                                class="action-button edit"
                                title="Edit"
                                data-action="edit"
                                data-id="${expense.id}"
                            >
                                <i class="fa-solid fa-pen"></i>
                            </button>

                            <button
                                type="button"
                                class="action-button delete"
                                title="Delete"
                                data-action="delete"
                                data-id="${expense.id}"
                            >
                                <i class="fa-solid fa-trash"></i>
                            </button>

                        </div>

                    </td>

                `;


                tbody.appendChild(
                    row
                );

            }
        );


    /*
       Event delegation for edit/delete
    */

    tbody
        .querySelectorAll(
            "[data-action='edit']"
        )
        .forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        const id =
                            Number(
                                button.dataset.id
                            );

                        openEditModal(
                            id
                        );

                    }
                );

            }
        );


    tbody
        .querySelectorAll(
            "[data-action='delete']"
        )
        .forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        const id =
                            Number(
                                button.dataset.id
                            );

                        openDeleteModal(
                            id
                        );

                    }
                );

            }
        );

}


/* ============================================================
   ESCAPE HTML
============================================================ */

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* ============================================================
   EDIT MODAL
============================================================ */

function setupEditModal() {

    const close =
        document.getElementById(
            "closeEditModal"
        );


    const cancel =
        document.getElementById(
            "cancelEdit"
        );


    const form =
        document.getElementById(
            "editExpenseForm"
        );


    if (close) {

        close.addEventListener(
            "click",
            closeEditModal
        );

    }


    if (cancel) {

        cancel.addEventListener(
            "click",
            closeEditModal
        );

    }


    if (form) {

        form.addEventListener(
            "submit",
            saveEditedExpense
        );

    }


    const editYear =
        document.getElementById(
            "editAcademicYear"
        );


    if (editYear) {

        editYear.addEventListener(
            "change",
            function () {

                updateSemesterOptions(
                    editYear.value,
                    document.getElementById(
                        "editSemester"
                    )
                );

            }
        );

    }

}


/* ============================================================
   OPEN EDIT MODAL
============================================================ */

function openEditModal(
    expenseId
) {

    const expense =
        allExpenses.find(
            function (item) {

                return (
                    Number(item.id) ===
                    Number(expenseId)
                );

            }
        );


    if (!expense) {

        showToast(
            "Expense not found.",
            "error"
        );

        return;

    }


    document.getElementById(
        "editExpenseId"
    ).value =
        expense.id;


    const editYear =
        document.getElementById(
            "editAcademicYear"
        );


    const editSemester =
        document.getElementById(
            "editSemester"
        );


    editYear.value =
        expense.academic_year;


    updateSemesterOptions(
        expense.academic_year,
        editSemester,
        expense.semester
    );


    document.getElementById(
        "editDate"
    ).value =
        formatDisplayDate(
            expense.date
        );


    document.getElementById(
        "editCategory"
    ).value =
        expense.category;


    document.getElementById(
        "editAmount"
    ).value =
        expense.amount;


    document.getElementById(
        "editPaymentMethod"
    ).value =
        expense.payment_method;


    document.getElementById(
        "editDescription"
    ).value =
        expense.description || "";


    const modal =
        document.getElementById(
            "editModal"
        );


    if (modal) {

        modal.classList.remove(
            "hidden"
        );

    }

}


/* ============================================================
   CLOSE EDIT MODAL
============================================================ */

function closeEditModal() {
    const modal =
        document.getElementById("editModal");

    if (modal) {
        modal.classList.add("hidden");
        modal.classList.remove("show");
    }
}


/* ============================================================
   SAVE EDITED EXPENSE
============================================================ */

async function saveEditedExpense(
    event
) {

    event.preventDefault();


    const id =
        Number(
            document.getElementById(
                "editExpenseId"
            ).value
        );


    const academicYear =
        document.getElementById(
            "editAcademicYear"
        ).value;


    const semester =
        document.getElementById(
            "editSemester"
        ).value;


    const displayDate =
        document.getElementById(
            "editDate"
        ).value.trim();


    const category =
        document.getElementById(
            "editCategory"
        ).value.trim();


    const amount =
        Number(
            document.getElementById(
                "editAmount"
            ).value
        );


    const paymentMethod =
        document.getElementById(
            "editPaymentMethod"
        ).value;


    const description =
        document.getElementById(
            "editDescription"
        ).value.trim();


    if (!academicYear) {

        showToast(
            "Please select an academic year.",
            "error"
        );

        return;

    }


    if (!semester) {

        showToast(
            "Please select a semester.",
            "error"
        );

        return;

    }


    if (
        !isValidDate(
            displayDate
        )
    ) {

        showToast(
            "Enter a valid date as DD-MM-YYYY.",
            "error"
        );

        return;

    }


    if (!category) {

        showToast(
            "Category is required.",
            "error"
        );

        return;

    }


    if (
        Number.isNaN(amount) ||
        amount < 0
    ) {

        showToast(
            "Enter a valid amount.",
            "error"
        );

        return;

    }


    if (!paymentMethod) {

        showToast(
            "Please select a payment method.",
            "error"
        );

        return;

    }


    const payload = {

        academic_year:
            academicYear,

        semester:
            semester,

        date:
            convertDateForBackend(
                displayDate
            ),

        category:
            category,

        amount:
            amount,

        payment_method:
            paymentMethod,

        description:
            description

    };


    const editForm = document.getElementById("editExpenseForm");
    const submitButton = getSubmitButton(editForm);
    setActionLoading(submitButton, "edit", "Saving...");


    try {

        const response =
            await fetch(
                `/api/expenses/${id}`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            payload
                        )
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.error ||
                "Could not update expense."
            );

        }


        closeEditModal();

        showToast(
            "Expense updated successfully.",
            "success"
        );

        await loadExpenses();
        await loadDashboard();
        showPage("expenses");


    } catch (error) {

        console.error(
            "UPDATE ERROR:",
            error
        );


        showToast(
            error.message,
            "error"
        );

    } finally {

        stopActionLoading(submitButton);

    }

}


/* ============================================================
   DELETE MODAL
============================================================ */

function setupDeleteModal() {

    const cancel =
        document.getElementById(
            "cancelDelete"
        );


    const confirm =
        document.getElementById(
            "confirmDelete"
        );


    if (cancel) {

        cancel.addEventListener(
            "click",
            closeDeleteModal
        );

    }


    if (confirm) {

        confirm.addEventListener(
            "click",
            deleteExpense
        );

    }

}


/* ============================================================
   OPEN DELETE MODAL
============================================================ */
function openDeleteModal(expenseId) {

    // Close Edit Expense modal first
    const editModal =
        document.getElementById("editModal");

    if (editModal) {
        editModal.classList.remove("show");
    }

    // Store expense ID
    expenseToDelete =
        Number(expenseId);

    // Open Delete Expense modal
    const deleteModal =
        document.getElementById("deleteModal");

    if (deleteModal) {
        deleteModal.classList.remove("hidden");
    }
}


/* ============================================================
   CLOSE DELETE MODAL
============================================================ */

function closeDeleteModal() {

    expenseToDelete =
        null;


    const modal =
        document.getElementById(
            "deleteModal"
        );


    if (modal) {

        modal.classList.add(
            "hidden"
        );

    }

}


/* ============================================================
   DELETE EXPENSE
============================================================ */

async function deleteExpense() {

    if (
        expenseToDelete === null
    ) {

        return;

    }


    const id =
        expenseToDelete;


    const confirmButton =
        document.getElementById("confirmDelete");

    setActionLoading(confirmButton, "delete", "Deleting...");


    try {

        const response =
            await fetch(
                `/api/expenses/${id}`,
                {
                    method: "DELETE"
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.error ||
                "Could not delete expense."
            );

        }


        closeDeleteModal();


        showToast(
            "Expense deleted successfully.",
            "success"
        );


        await loadExpenses();

        await loadDashboard();

    } catch (error) {

        console.error(
            "DELETE ERROR:",
            error
        );


        showToast(
            error.message,
            "error"
        );

    } finally {

        stopActionLoading(confirmButton);

    }

}


/* ============================================================
   DASHBOARD
============================================================ */

async function loadDashboard() {

    try {

        const response =
            await fetch(
                "/api/stats",
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Could not load dashboard."
            );

        }


        const stats =
            await response.json();


        if (stats.error) {

            throw new Error(
                stats.error
            );

        }


        updateDashboardCards(
            stats
        );


        updateCategoryChart(
            stats.category_totals || {}
        );


        updateYearChart(
            stats.year_totals || {}
        );


    } catch (error) {

        console.error(
            "DASHBOARD ERROR:",
            error
        );


        showToast(
            "Unable to load dashboard data.",
            "error"
        );

    }
}


/* ============================================================
   DASHBOARD CARDS
============================================================ */

function updateDashboardCards(
    stats
) {

    const thisMonth =
        document.getElementById(
            "dashboardThisMonth"
        );


    const monthlyAverage =
        document.getElementById(
            "dashboardMonthlyAverage"
        );


    const highestExpense =
        document.getElementById(
            "dashboardHighestExpense"
        );


    const highestInfo =
        document.getElementById(
            "dashboardHighestExpenseInfo"
        );


    const cashSpending =
        document.getElementById(
            "dashboardCashSpending"
        );


    const cashPercentage =
        document.getElementById(
            "dashboardCashPercentage"
        );


    if (thisMonth) {

        thisMonth.textContent =
            formatCurrency(
                stats.this_month
            );

    }


    if (monthlyAverage) {

        monthlyAverage.textContent =
            formatCurrency(
                stats.monthly_average
            );

    }


    if (stats.highest_expense) {

        if (highestExpense) {

            highestExpense.textContent =
                formatCurrency(
                    stats.highest_expense.amount
                );

        }


        if (highestInfo) {

            highestInfo.textContent =
                (
                    stats.highest_expense.category ||
                    "Expense"
                ) +
                " • " +
                (
                    stats.highest_expense.date ||
                    ""
                );

        }

    } else {

        if (highestExpense) {

            highestExpense.textContent =
                formatCurrency(0);

        }


        if (highestInfo) {

            highestInfo.textContent =
                "No expenses yet";

        }

    }


    const paymentTotals =
        stats.payment_totals || {};

    // Calculate Cash directly from the current expense list as the
    // source of truth. This prevents the Cash card from becoming
    // stale when the stats response is cached or uses a slightly
    // different payment-method spelling/capitalization.
    const cashFromExpenses =
        Array.isArray(allExpenses)
            ? allExpenses.reduce(function (sum, expense) {
                const method = String(
                    expense.payment_method || ""
                ).trim().toLowerCase();

                return method === "cash"
                    ? sum + (Number(expense.amount) || 0)
                    : sum;
            }, 0)
            : 0;

    const cashFromStats =
        Number(paymentTotals["Cash"] || 0);

    // Prefer the freshly loaded expense data. If it is not available,
    // fall back to the backend stats value.
    const cash =
        Array.isArray(allExpenses)
            ? cashFromExpenses
            : cashFromStats;

    const total =
        Number(
            stats.total_expenses || 0
        );


    const percentage =
        total > 0
            ? (
                cash /
                total *
                100
            )
            : 0;


    if (cashSpending) {

        cashSpending.textContent =
            formatCurrency(
                cash
            );

    }


    if (cashPercentage) {

        cashPercentage.textContent =
            percentage.toFixed(1) +
            "% of total";

    }

}


/* ============================================================
   CATEGORY CHART
============================================================ */

/* ============================================================
   CATEGORY CHART COLORS
   Each category gets a unique, consistent color.
============================================================ */

const CATEGORY_PALETTE = [
    "#8B5CF6", // Purple
    "#3B82F6", // Blue
    "#10B981", // Green
    "#F59E0B", // Amber
    "#EF4444", // Red
    "#EC4899", // Pink
    "#06B6D4", // Cyan
    "#F97316", // Orange
    "#14B8A6", // Teal
    "#A855F7", // Violet
    "#EAB308", // Yellow
    "#6366F1", // Indigo
    "#22C55E", // Green
    "#F43F5E", // Rose
    "#0EA5E9", // Sky
    "#D946EF", // Fuchsia
    "#84CC16", // Lime
    "#FB7185"  // Light rose
];


/* ============================================================
   GET CATEGORY COLOR
============================================================ */

function getCategoryColor(index) {

    return CATEGORY_PALETTE[
        index % CATEGORY_PALETTE.length
    ];

}


/* ============================================================
   CATEGORY CHART
============================================================ */

function updateCategoryChart(categoryTotals) {

    const canvas =
        document.getElementById("categoryChart");

    if (!canvas) {
        return;
    }


    /* -----------------------------------------
       Remove zero-value categories
    ----------------------------------------- */

    const entries =
        Object.entries(categoryTotals || {})
            .filter(function (entry) {

                return Number(entry[1]) > 0;

            })
            .sort(function (a, b) {

                return Number(b[1]) - Number(a[1]);

            });


    const labels =
        entries.map(function (entry) {

            return entry[0];

        });


    const values =
        entries.map(function (entry) {

            return Number(entry[1]);

        });


    /* -----------------------------------------
       Give EVERY category its own color
    ----------------------------------------- */

    const colors =
        labels.map(function (category, index) {

            return getCategoryColor(index);

        });


    /* -----------------------------------------
       Calculate total
    ----------------------------------------- */

    const total =
        values.reduce(
            function (sum, value) {

                return sum + value;

            },
            0
        );


    /* -----------------------------------------
       Update center text
    ----------------------------------------- */

    const totalElement =
        document.getElementById(
            "categoryChartTotal"
        );

    const countElement =
        document.getElementById(
            "categoryChartCount"
        );


    if (totalElement) {

        totalElement.textContent =
            formatCurrency(total);

    }


    if (countElement) {

        countElement.textContent =
            labels.length +
            (
                labels.length === 1
                    ? " Category"
                    : " Categories"
            );

    }


    /* -----------------------------------------
       Bottom summary
    ----------------------------------------- */

    const categoryCount =
        document.getElementById(
            "dashboardCategoryCount"
        );

    const categoryTotal =
        document.getElementById(
            "dashboardCategoryTotal"
        );


    if (categoryCount) {

        categoryCount.textContent =
            labels.length;

    }


    if (categoryTotal) {

        categoryTotal.textContent =
            formatCurrency(total);

    }


    /* -----------------------------------------
       Update legend
    ----------------------------------------- */

    updateCategoryLegend(
        entries,
        total,
        colors
    );


    /* -----------------------------------------
       Destroy old chart
    ----------------------------------------- */

    if (categoryChart) {

        categoryChart.destroy();

        categoryChart = null;

    }


    /* -----------------------------------------
       No data
    ----------------------------------------- */

    if (values.length === 0) {

        return;

    }


    /* -----------------------------------------
       Create new donut chart
    ----------------------------------------- */

    categoryChart =
        new Chart(
            canvas.getContext("2d"),
            {

                type: "doughnut",

                data: {

                    labels: labels,

                    datasets: [

                        {

                            data: values,

                            backgroundColor: colors,

                            borderColor:
                                "#11172F",

                            borderWidth: 3,

                            hoverBorderColor:
                                "#FFFFFF",

                            hoverBorderWidth: 4,

                            hoverOffset: 8

                        }

                    ]

                },


                options: {

                    responsive: true,

                    maintainAspectRatio: true,

                    cutout: "64%",


                    animation: {

                        duration: 700

                    },


                    plugins: {

                        legend: {

                            display: false

                        },


                        tooltip: {

                            backgroundColor:
                                "#11172F",

                            titleColor:
                                "#FFFFFF",

                            bodyColor:
                                "#FFFFFF",

                            borderColor:
                                "#334155",

                            borderWidth: 1,

                            padding: 12,


                            callbacks: {

                                label:
                                    function (context) {

                                        const value =
                                            Number(
                                                context.raw
                                            );


                                        const percentage =
                                            total > 0
                                                ? (
                                                    value /
                                                    total
                                                ) * 100
                                                : 0;


                                        return (
                                            " " +
                                            context.label +
                                            ": " +
                                            formatCurrency(
                                                value
                                            ) +
                                            " (" +
                                            percentage.toFixed(1) +
                                            "%)"
                                        );

                                    }

                            }

                        }

                    }

                }

            }
        );

}


/* ============================================================
   CATEGORY LEGEND
============================================================ */

function updateCategoryLegend(
    entries,
    total,
    colors
) {

    const container =
        document.getElementById(
            "categoryLegend"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    if (
        !entries ||
        entries.length === 0
    ) {

        container.innerHTML = `
            <div class="empty-state">
                No expenses yet
            </div>
        `;

        return;

    }


    entries.forEach(
        function (entry, index) {

            const category =
                entry[0];


            const amount =
                Number(entry[1]);


            const percentage =
                total > 0
                    ? (
                        amount /
                        total
                    ) * 100
                    : 0;


            const color =
                colors[index];


            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "legend-item";


            /*
               IMPORTANT:
               The exact same color used by
               the donut is used here.
            */

            item.innerHTML = `

                <div class="legend-main">

                    <span
                        class="legend-dot"
                        style="
                            background-color:${color};
                            box-shadow:0 0 8px ${color};
                        "
                    ></span>


                    <span class="legend-name">
                        ${escapeHTML(category)}
                    </span>


                    <span class="legend-value">
                        ${formatCurrency(amount)}
                    </span>


                    <span
                        class="legend-percentage"
                        style="
                            color:${color};
                            background:${color}20;
                            border:1px solid ${color}55;
                        "
                    >
                        ${percentage.toFixed(1)}%
                    </span>

                </div>


                <div class="legend-progress">

                    <div
                        class="legend-progress-bar"
                        style="
                            width:${percentage}%;
                            background:${color};
                            box-shadow:0 0 6px ${color};
                        "
                    ></div>

                </div>

            `;


            container.appendChild(
                item
            );

        }
    );

}





/* ============================================================
   YEAR CHART
============================================================ */

function updateYearChart(
    yearTotals
) {

    const canvas =
        document.getElementById(
            "yearChart"
        );


    if (!canvas) {
        return;
    }


    const labels = [

        "1st Year",
        "2nd Year",
        "3rd Year",
        "4th Year"

    ];


    const values =
        labels.map(
            function (year) {

                return Number(
                    yearTotals[year] || 0
                );

            }
        );


    if (yearChart) {

        yearChart.destroy();

        yearChart = null;

    }


    yearChart =
        new Chart(
            canvas.getContext("2d"),
            {

                type: "bar",

                data: {

                    labels:
                        labels,

                    datasets: [

                        {

                            label:
                                "Expenses",

                            data:
                                values,

                            backgroundColor:
                                [
                                    "#8b5cf6",
                                    "#3b82f6",
                                    "#10b981",
                                    "#f59e0b"
                                ],

                            borderRadius: 8,

                            borderSkipped:
                                false

                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {
                            display: false
                        },

                        tooltip: {

                            callbacks: {

                                label:
                                    function (
                                        context
                                    ) {

                                        return (
                                            " " +
                                            formatCurrency(
                                                context.raw
                                            )
                                        );

                                    }

                            }

                        }

                    },

                    scales: {

                        y: {

                            beginAtZero:
                                true,

                            ticks: {

                                callback:
                                    function (
                                        value
                                    ) {

                                        return (
                                            "₹" +
                                            Number(
                                                value
                                            ).toLocaleString(
                                                "en-IN"
                                            )
                                        );

                                    }

                            }

                        },

                        x: {

                            grid: {
                                display: false
                            }

                        }

                    }

                }

            }
        );

}


/* ============================================================
   CATEGORIES PAGE
============================================================ */

function setupCategoryPage() {

    const button =
        document.getElementById(
            "categoryAddExpense"
        );


    if (button) {

        button.addEventListener(
            "click",
            function () {

                showPage(
                    "add-expense"
                );

            }
        );

    }

}


function renderCategoryPage() {

    const container =
        document.getElementById(
            "categoryCards"
        );


    if (!container) {
        return;
    }


    const totals = {};


    allExpenses.forEach(
        function (expense) {

            const category =
                expense.category ||
                "Other";


            totals[category] =
                (
                    totals[category] ||
                    0
                ) +
                Number(
                    expense.amount || 0
                );

        }
    );


    const categories =
        Object.entries(
            totals
        )
            .sort(
                function (a, b) {

                    return (
                        Number(b[1]) -
                        Number(a[1])
                    );

                }
            );


    container.innerHTML = "";


    if (categories.length === 0) {

        const empty =
            document.createElement(
                "div"
            );


        empty.className =
            "loading-card";


        empty.textContent =
            "No expenses yet. Add an expense to see categories.";

        container.appendChild(
            empty
        );

        return;

    }


    categories.forEach(
        function (entry) {

            const category =
                entry[0];


            const amount =
                Number(entry[1]);


            const count =
                allExpenses.filter(
                    function (expense) {

                        return (
                            expense.category ===
                            category
                        );

                    }
                ).length;


            const icon =
                CATEGORY_ICONS[
                category
                ] ||
                CATEGORY_ICONS["Other"];


            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "category-card";


            card.innerHTML = `

                <div class="category-card-icon">

                    <i class="fa-solid ${icon}"></i>

                </div>

                <div>

                    <h3>
                        ${escapeHTML(category)}
                    </h3>

                    <strong>
                        ${formatCurrency(amount)}
                    </strong>

                    <p>
                        ${count}
                        ${count === 1 ? "expense" : "expenses"}
                    </p>

                </div>

            `;


            container.appendChild(
                card
            );

        }
    );

}


/* ============================================================
   ACADEMIC PAGE
============================================================ */

function setupAcademicPage() {

    // Navigation already handles this page.

}


function renderAcademicPage() {

    renderAcademicYears();

    renderSemesters();

}


function renderAcademicYears() {

    const container =
        document.getElementById(
            "academicYearCards"
        );


    if (!container) {
        return;
    }


    const years = [

        "1st Year",
        "2nd Year",
        "3rd Year",
        "4th Year"

    ];


    container.innerHTML = "";


    years.forEach(
        function (year) {

            const amount =
                allExpenses
                    .filter(
                        function (expense) {

                            return (
                                expense.academic_year ===
                                year
                            );

                        }
                    )
                    .reduce(
                        function (sum, expense) {

                            return (
                                sum +
                                Number(
                                    expense.amount || 0
                                )
                            );

                        },
                        0
                    );


            const count =
                allExpenses.filter(
                    function (expense) {

                        return (
                            expense.academic_year ===
                            year
                        );

                    }
                ).length;


            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "category-card";


            card.innerHTML = `

                <div class="category-card-icon">

                    <i class="fa-solid fa-graduation-cap"></i>

                </div>

                <div>

                    <h3>
                        ${year}
                    </h3>

                    <strong>
                        ${formatCurrency(amount)}
                    </strong>

                    <p>
                        ${count}
                        ${count === 1 ? "expense" : "expenses"}
                    </p>

                </div>

            `;


            container.appendChild(
                card
            );

        }
    );

}


function renderSemesters() {

    const container =
        document.getElementById(
            "semesterCards"
        );


    if (!container) {
        return;
    }


    const semesters = [

        "1st Sem",
        "2nd Sem",
        "3rd Sem",
        "4th Sem",
        "5th Sem",
        "6th Sem",
        "7th Sem",
        "8th Sem"

    ];


    container.innerHTML = "";


    semesters.forEach(
        function (semester) {

            const amount =
                allExpenses
                    .filter(
                        function (expense) {

                            return (
                                expense.semester ===
                                semester
                            );

                        }
                    )
                    .reduce(
                        function (sum, expense) {

                            return (
                                sum +
                                Number(
                                    expense.amount || 0
                                )
                            );

                        },
                        0
                    );


            const count =
                allExpenses.filter(
                    function (expense) {

                        return (
                            expense.semester ===
                            semester
                        );

                    }
                ).length;


            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "category-card";


            card.innerHTML = `

                <div class="category-card-icon">

                    <i class="fa-solid fa-book-open"></i>

                </div>

                <div>

                    <h3>
                        ${semester}
                    </h3>

                    <strong>
                        ${formatCurrency(amount)}
                    </strong>

                    <p>
                        ${count}
                        ${count === 1 ? "expense" : "expenses"}
                    </p>

                </div>

            `;


            container.appendChild(
                card
            );

        }
    );

}


/* ============================================================
   BACKUP
============================================================ */

function setupBackup() {

    // Download button is a normal link.
    // Update information when page opens.

}


function updateBackupInformation() {

    const count =
        document.getElementById(
            "backupRecordCount"
        );


    const total =
        document.getElementById(
            "backupTotalAmount"
        );


    if (count) {

        count.textContent =
            allExpenses.length;

    }


    const totalAmount =
        allExpenses.reduce(
            function (sum, expense) {

                return (
                    sum +
                    Number(
                        expense.amount || 0
                    )
                );

            },
            0
        );


    if (total) {

        total.textContent =
            formatCurrency(
                totalAmount
            );

    }

}


/* ============================================================
   SETTINGS
============================================================ */

function loadSettings() {

    const savedTheme =
        localStorage.getItem(
            "expenseTrackerTheme"
        );


    const darkSwitch =
        document.getElementById(
            "darkModeSwitch"
        );


    if (
        savedTheme ===
        "dark"
    ) {

        document.body.classList.add(
            "dark-mode"
        );


        if (darkSwitch) {

            darkSwitch.checked =
                true;

        }

    } else {

        document.body.classList.remove(
            "dark-mode"
        );


        if (darkSwitch) {

            darkSwitch.checked =
                false;

        }

    }


    updateThemeIcon();

}


function updateSettingsInformation() {

    const count =
        document.getElementById(
            "settingsRecordCount"
        );


    if (count) {

        count.textContent =
            allExpenses.length;

    }

}


/* ============================================================
   THEME
============================================================ */

function setupTheme() {

    const darkSwitch =
        document.getElementById(
            "darkModeSwitch"
        );


    if (!darkSwitch) {
        return;
    }


    darkSwitch.addEventListener(
        "change",
        function () {

            if (
                darkSwitch.checked
            ) {

                document.body.classList.add(
                    "dark-mode"
                );


                localStorage.setItem(
                    "expenseTrackerTheme",
                    "dark"
                );

            } else {

                document.body.classList.remove(
                    "dark-mode"
                );


                localStorage.setItem(
                    "expenseTrackerTheme",
                    "light"
                );

            }


            updateThemeIcon();

        }
    );

}


function updateThemeIcon() {

    const icon =
        document.querySelector(
            "#themeToggle i"
        );


    if (!icon) {
        return;
    }


    if (
        document.body.classList.contains(
            "dark-mode"
        )
    ) {

        icon.className =
            "fa-solid fa-sun";

    } else {

        icon.className =
            "fa-solid fa-moon";

    }

}


/* ============================================================
   HEADER
============================================================ */

function setupHeaderButtons() {

    const themeButton =
        document.getElementById(
            "themeToggle"
        );


    if (themeButton) {

        themeButton.addEventListener(
            "click",
            function () {

                const darkSwitch =
                    document.getElementById(
                        "darkModeSwitch"
                    );


                const isDark =
                    document.body.classList.contains(
                        "dark-mode"
                    );


                if (darkSwitch) {

                    darkSwitch.checked =
                        !isDark;

                    darkSwitch.dispatchEvent(
                        new Event(
                            "change"
                        )
                    );

                } else {

                    document.body.classList.toggle(
                        "dark-mode"
                    );

                    updateThemeIcon();

                }

            }
        );

    }


    const notificationButton =
        document.getElementById(
            "notificationButton"
        );


    if (notificationButton) {

        notificationButton.addEventListener(
            "click",
            function () {

                if (
                    allExpenses.length === 0
                ) {

                    showToast(
                        "You have no expense records yet.",
                        "success"
                    );

                } else {

                    showToast(
                        `${allExpenses.length} expense records are stored.`,
                        "success"
                    );

                }

            }
        );

    }

}


/* ============================================================
   GLOBAL SEARCH
============================================================ */

function setupGlobalSearch() {

    const search =
        document.getElementById(
            "globalSearch"
        );


    if (!search) {
        return;
    }


    search.addEventListener(
        "input",
        function () {

            const value =
                search.value.trim();


            if (!value) {

                return;

            }


            showPage(
                "expenses"
            );


            const expenseSearch =
                document.getElementById(
                    "expenseSearch"
                );


            if (expenseSearch) {

                expenseSearch.value =
                    value;

            }


            renderExpenses();

        }
    );


    document.addEventListener(
        "keydown",
        function (event) {

            if (
                (
                    event.ctrlKey ||
                    event.metaKey
                ) &&
                event.key === "/"
            ) {

                event.preventDefault();

                search.focus();

            }

        }
    );

}


/* ============================================================
   TOAST
============================================================ */

function showToast(
    message,
    type = "success"
) {

    const toast =
        document.getElementById(
            "toast"
        );


    const toastMessage =
        document.getElementById(
            "toastMessage"
        );


    const toastIcon =
        document.getElementById(
            "toastIcon"
        );


    if (
        !toast ||
        !toastMessage
    ) {

        return;

    }


    toastMessage.textContent =
        message;


    if (toastIcon) {

        if (
            type === "error"
        ) {

            toastIcon.className =
                "fa-solid fa-circle-exclamation";


            toastIcon.style.color =
                "#ef4444";

        } else {

            toastIcon.className =
                "fa-solid fa-circle-check";


            toastIcon.style.color =
                "#34d399";

        }

    }


    toast.classList.remove(
        "hidden"
    );


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            function () {

                toast.classList.add(
                    "hidden"
                );

            },
            3000
        );

}


/* ============================================================
   KEYBOARD ESC
============================================================ */

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key !==
            "Escape"
        ) {

            return;

        }


        closeEditModal();

        closeDeleteModal();

    }
);


/* ============================================================
   CLICK OUTSIDE MODALS
============================================================ */

document.addEventListener(
    "click",
    function (event) {

        const editModal =
            document.getElementById(
                "editModal"
            );


        const deleteModal =
            document.getElementById(
                "deleteModal"
            );


        if (
            editModal &&
            event.target ===
            editModal
        ) {

            closeEditModal();

        }


        if (
            deleteModal &&
            event.target ===
            deleteModal
        ) {

            closeDeleteModal();

        }

    }
);
/* ============================================================
   SAVINGS
============================================================ */

let savingsGoals = [];

let savingsHistory = [];

let savingsProgressChart = null;


/* ============================================================
   LOAD SAVINGS
============================================================ */

async function loadSavings() {

    try {

        const response =
            await fetch(
                "/api/savings",
                {
                    cache: "no-store"
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.error ||
                "Unable to load savings."
            );

        }


        savingsGoals =
            result.goals || [];


        savingsHistory =
            result.history || [];


        renderSavingsPage();


    } catch (error) {

        console.error(
            "SAVINGS ERROR:",
            error
        );

    }

}


/* ============================================================
   RENDER SAVINGS PAGE
============================================================ */

function renderSavingsPage() {

    renderSavingsSummary();

    renderSavingsGoals();

    renderSavingsHistory();

    updateSavingsGoalSelect();

    renderSavingsProgress();

}


/* ============================================================
   SAVINGS SUMMARY
============================================================ */

function renderSavingsSummary() {

    const totalSaved =
        savingsHistory.reduce(
            (
                total,
                item
            ) =>
                total +
                Number(
                    item.amount || 0
                ),
            0
        );


    const activeGoals =
        savingsGoals.filter(
            goal =>
                !goal.completed
        ).length;


    const completedGoals =
        savingsGoals.filter(
            goal =>
                goal.completed
        ).length;


    setText(
        "totalSavedAmount",
        formatRupees(
            totalSaved
        )
    );


    setText(
        "activeGoalsCount",
        activeGoals
    );


    setText(
        "completedGoalsCount",
        completedGoals
    );

}


/* ============================================================
   RENDER SAVINGS GOALS
============================================================ */

function renderSavingsGoals() {

    const container =
        document.getElementById(
            "savingsGoalsContainer"
        );


    if (!container) {

        return;

    }


    if (
        savingsGoals.length === 0
    ) {

        container.innerHTML = `

            <div class="savings-empty">

                <i class="fa-solid fa-bullseye"></i>

                <h3>
                    No savings goals yet
                </h3>

                <p>
                    Create your first savings goal
                    and start working towards it.
                </p>

                <button
                    type="button"
                    class="primary-button"
                    onclick="openSavingsGoalModal()"
                >

                    <i class="fa-solid fa-plus"></i>

                    Create Savings Goal

                </button>

            </div>

        `;

        return;

    }


    container.innerHTML =
        savingsGoals
            .map(
                goal => {

                    const progress =
                        Math.min(
                            Math.max(
                                Number(
                                    goal.progress ||
                                    0
                                ),
                                0
                            ),
                            100
                        );


                    const completed =
                        goal.completed;


                    return `

                        <div
                            class="savings-goal-card"
                        >

                            <div class="savings-goal-top">

                                <div class="savings-goal-icon">

                                    <i class="fa-solid fa-piggy-bank"></i>

                                </div>


                                <div class="savings-goal-info">

                                    <h3>
                                        ${escapeHtml(
                        goal.name
                    )}
                                    </h3>

                                    <p>
                                        ${escapeHtml(
                        goal.description ||
                        "Savings goal"
                    )}
                                    </p>

                                </div>


                                <button
                                    type="button"
                                    class="savings-goal-menu"
                                    title="Delete goal"
                                    onclick="deleteSavingsGoal(
                                        ${goal.id},
                                        this
                                    )"
                                >

                                    <i class="fa-solid fa-ellipsis-vertical"></i>

                                </button>

                            </div>


                            <div class="savings-goal-amounts">

                                <span class="savings-goal-saved">

                                    ${formatRupees(
                        goal.saved_amount
                    )}

                                </span>


                                <span class="savings-goal-target">

                                    /
                                    ${formatRupees(
                        goal.target_amount
                    )}

                                </span>

                            </div>


                            <div class="savings-progress-row">

                                <div class="savings-progress-track">

                                    <div
                                        class="
                                            savings-progress-bar
                                            ${completed
                            ? "savings-completed-bar"
                            : ""
                        }
                                        "
                                        style="
                                            width:${progress}%;
                                        "
                                    ></div>

                                </div>


                                <span
                                    class="
                                        savings-progress-percent
                                        ${completed
                            ? "savings-completed"
                            : ""
                        }
                                    "
                                >

                                    ${progress.toFixed(1)}%

                                </span>

                            </div>


                            <div class="savings-goal-bottom">

                                <span>

                                    ${completed
                            ? "🎉 Goal Completed"
                            : formatRupees(
                                goal.remaining_amount
                            ) +
                            " remaining"
                        }

                                </span>


                                <span>

                                    ${goal.target_date
                            ? "Target: " +
                            escapeHtml(
                                goal.target_date
                            )
                            : "No target date"
                        }

                                </span>

                            </div>


                            ${completed
                            ? ""
                            : `

                                        <div class="savings-goal-actions">

                                            <button
                                                type="button"
                                                class="primary-button"
                                                onclick="openAddSavingsModal(
                                                    ${goal.id}
                                                )"
                                            >

                                                <i class="fa-solid fa-plus"></i>

                                                Add Savings

                                            </button>

                                        </div>

                                    `
                        }

                        </div>

                    `;

                }
            )
            .join("");

}


/* ============================================================
   UPDATE GOAL SELECT
============================================================ */

function updateSavingsGoalSelect() {

    const select =
        document.getElementById(
            "savingsGoalSelect"
        );


    if (!select) {

        return;

    }


    const current =
        select.value;


    select.innerHTML = `

        <option value="">
            Select Goal
        </option>

    `;


    savingsGoals
        .filter(
            goal =>
                !goal.completed
        )
        .forEach(
            goal => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    goal.id;


                option.textContent =
                    goal.name;


                select.appendChild(
                    option
                );

            }
        );


    if (current) {

        select.value =
            current;

    }

}


/* ============================================================
   OPEN GOAL MODAL
============================================================ */

function openSavingsGoalModal() {

    const modal =
        document.getElementById(
            "savingsGoalModal"
        );


    if (modal) {

        modal.classList.remove("hidden");

    }

}


/* ============================================================
   CLOSE GOAL MODAL
============================================================ */

function closeSavingsGoalModal() {

    const modal =
        document.getElementById(
            "savingsGoalModal"
        );


    if (modal) {

        modal.classList.add("hidden");

    }


    const form =
        document.getElementById(
            "savingsGoalForm"
        );


    if (form) {

        form.reset();

    }

}


/* ============================================================
   CREATE GOAL
============================================================ */

document
    .getElementById(
        "savingsGoalForm"
    )
    ?.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const name =
                document.getElementById(
                    "savingsGoalName"
                ).value.trim();


            const targetAmount =
                Number(
                    document.getElementById(
                        "savingsTargetAmount"
                    ).value
                );


            const targetDate =
                document.getElementById(
                    "savingsTargetDate"
                ).value.trim();


            const description =
                document.getElementById(
                    "savingsGoalDescription"
                ).value.trim();


            if (!name) {

                alert(
                    "Please enter a goal name."
                );

                return;

            }


            if (
                !Number.isFinite(
                    targetAmount
                ) ||
                targetAmount <= 0
            ) {

                alert(
                    "Please enter a valid target amount."
                );

                return;

            }


            if (
                targetDate &&
                !isValidDateFormat(
                    targetDate
                )
            ) {

                alert(
                    "Please enter the target date as DD-MM-YYYY."
                );

                return;

            }


            const submitButton = getSubmitButton(
                document.getElementById("savingsGoalForm")
            );
            setActionLoading(submitButton, "save", "Creating...");


            try {

                const response =
                    await fetch(
                        "/api/savings/goals",
                        {

                            method:
                                "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({

                                    name:
                                        name,

                                    target_amount:
                                        targetAmount,

                                    target_date:
                                        targetDate,

                                    description:
                                        description

                                })

                        }
                    );


                const result =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        result.error ||
                        "Unable to create goal."
                    );

                }


                closeSavingsGoalModal();


                await loadSavings();


                showPage(
                    "savings"
                );


                alert(
                    "Savings goal created successfully!"
                );


            } catch (error) {

                console.error(
                    error
                );


                alert(
                    error.message
                );

            } finally {

                stopActionLoading(submitButton);

            }

        }
    );


/* ============================================================
   OPEN ADD SAVINGS
============================================================ */

function openAddSavingsModal(
    goalId = ""
) {

    updateSavingsGoalSelect();


    const select =
        document.getElementById(
            "savingsGoalSelect"
        );


    if (select && goalId) {

        select.value =
            goalId;

    }


    const modal =
        document.getElementById(
            "addSavingsModal"
        );


    if (modal) {

        modal.classList.remove("hidden");

    }

}


/* ============================================================
   CLOSE ADD SAVINGS
============================================================ */

function closeAddSavingsModal() {

    const modal =
        document.getElementById(
            "addSavingsModal"
        );


    if (modal) {

        modal.classList.add("hidden");

    }


    const form =
        document.getElementById(
            "addSavingsForm"
        );


    if (form) {

        form.reset();

    }

}


/* ============================================================
   ADD SAVINGS
============================================================ */

document
    .getElementById(
        "addSavingsForm"
    )
    ?.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const goalId =
                Number(
                    document.getElementById(
                        "savingsGoalSelect"
                    ).value
                );


            const amount =
                Number(
                    document.getElementById(
                        "savingsAmount"
                    ).value
                );


            const date =
                document.getElementById(
                    "savingsDate"
                ).value.trim();


            const note =
                document.getElementById(
                    "savingsNote"
                ).value.trim();


            if (!goalId) {

                alert(
                    "Please select a savings goal."
                );

                return;

            }


            if (
                !Number.isFinite(
                    amount
                ) ||
                amount <= 0
            ) {

                alert(
                    "Please enter a valid savings amount."
                );

                return;

            }


            if (
                !isValidDateFormat(
                    date
                )
            ) {

                alert(
                    "Please enter the date as DD-MM-YYYY."
                );

                return;

            }


            const submitButton = getSubmitButton(
                document.getElementById("addSavingsForm")
            );
            setActionLoading(submitButton, "add", "Adding...");


            try {

                const response =
                    await fetch(
                        "/api/savings",
                        {

                            method:
                                "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({

                                    goal_id:
                                        goalId,

                                    amount:
                                        amount,

                                    date:
                                        date,

                                    note:
                                        note

                                })

                        }
                    );


                const result =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        result.error ||
                        "Unable to add savings."
                    );

                }


                closeAddSavingsModal();


                await loadSavings();


                showPage(
                    "savings"
                );


                alert(
                    "Savings added successfully!"
                );


            } catch (error) {

                console.error(
                    error
                );


                alert(
                    error.message
                );

            } finally {

                stopActionLoading(submitButton);

            }

        }
    );


/* ============================================================
   SAVINGS HISTORY
============================================================ */

function renderSavingsHistory() {

    const body =
        document.getElementById(
            "savingsHistoryBody"
        );


    if (!body) {

        return;

    }


    if (
        savingsHistory.length === 0
    ) {

        body.innerHTML = `

            <tr>

                <td
                    colspan="5"
                    class="table-empty"
                >

                    No savings recorded yet.

                </td>

            </tr>

        `;

        return;

    }


    const sorted =
        [...savingsHistory]
            .sort(
                (
                    a,
                    b
                ) =>
                    Number(b.id) -
                    Number(a.id)
            )
            .slice(
                0,
                10
            );


    body.innerHTML =
        sorted
            .map(
                item => `

                    <tr>

                        <td>

                            ${escapeHtml(
                    item.date
                )}

                        </td>


                        <td>

                            <span
                                class="savings-history-goal"
                            >

                                ${escapeHtml(
                    item.goal_name
                )}

                            </span>

                        </td>


                        <td>

                            <strong
                                class="savings-history-amount"
                            >

                                +
                                ${formatRupees(
                    item.amount
                )}

                            </strong>

                        </td>


                        <td>

                            ${escapeHtml(
                    item.note ||
                    "—"
                )}

                        </td>


                        <td>

                            <div
                                class="savings-history-actions"
                            >

                                <button
                                    type="button"
                                    class="savings-history-delete"
                                    title="Delete"
                                    onclick="deleteSavings(
                                        ${item.id},
                                        this
                                    )"
                                >

                                    <i
                                        class="fa-solid fa-trash"
                                    ></i>

                                </button>

                            </div>

                        </td>

                    </tr>

                `
            )
            .join("");

}


/* ============================================================
   DELETE SAVINGS
============================================================ */

async function deleteSavings(
    id,
    button = null
) {

    const item =
        savingsHistory.find(
            record =>
                Number(
                    record.id
                ) ===
                Number(id)
        );


    if (!item) {

        return;

    }


    const confirmed =
        confirm(
            `Delete this savings record?\n\n` +
            `${item.goal_name} - ` +
            `${formatRupees(item.amount)}`
        );


    if (!confirmed) {

        return;

    }


    setDeleteIconLoading(button);


    try {

        const response =
            await fetch(
                `/api/savings/${id}`,
                {
                    method:
                        "DELETE"
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.error ||
                "Unable to delete savings."
            );

        }


        await loadSavings();


    } catch (error) {

        console.error(
            error
        );


        alert(
            error.message
        );

    } finally {

        stopActionLoading(button);

    }

}


/* ============================================================
   DELETE GOAL
============================================================ */

async function deleteSavingsGoal(
    goalId,
    button = null
) {

    const goal =
        savingsGoals.find(
            item =>
                Number(item.id) ===
                Number(goalId)
        );


    if (!goal) {

        return;

    }


    const confirmed =
        confirm(
            `Delete savings goal "${goal.name}"?\n\n` +
            `All savings records for this goal will also be deleted.`
        );


    if (!confirmed) {

        return;

    }


    setDeleteIconLoading(button);


    try {

        const response =
            await fetch(
                `/api/savings/goals/${goalId}`,
                {
                    method:
                        "DELETE"
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            throw new Error(
                result.error ||
                "Unable to delete goal."
            );

        }


        await loadSavings();


    } catch (error) {

        console.error(
            error
        );


        alert(
            error.message
        );

    } finally {

        stopActionLoading(button);

    }

}


/* ============================================================
   SAVINGS PROGRESS CHART
============================================================ */

function renderSavingsProgress() {

    const canvas =
        document.getElementById(
            "savingsProgressChart"
        );


    if (!canvas) {

        return;

    }


    if (savingsProgressChart) {

        savingsProgressChart.destroy();

        savingsProgressChart =
            null;

    }


    if (
        savingsHistory.length === 0
    ) {

        return;

    }


    const monthly = {};


    savingsHistory.forEach(
        item => {

            const parts =
                item.date.split("-");


            if (
                parts.length !== 3
            ) {

                return;

            }


            const month =
                parts[1];


            const year =
                parts[2];


            const key =
                `${year}-${month}`;


            monthly[key] =
                (
                    monthly[key] ||
                    0
                ) +
                Number(
                    item.amount || 0
                );

        }
    );


    const sortedMonths =
        Object.keys(
            monthly
        ).sort();


    let runningTotal = 0;


    const labels = [];


    const values = [];


    sortedMonths.forEach(
        key => {

            runningTotal +=
                monthly[key];


            const parts =
                key.split("-");


            const year =
                parts[0];


            const month =
                Number(
                    parts[1]
                );


            const date =
                new Date(
                    Number(year),
                    month - 1,
                    1
                );


            labels.push(

                date.toLocaleDateString(
                    "en-IN",
                    {
                        month: "short",
                        year: "numeric"
                    }
                )

            );


            values.push(
                runningTotal
            );

        }
    );


    savingsProgressChart =
        new Chart(
            canvas,
            {

                type:
                    "line",

                data: {

                    labels:
                        labels,

                    datasets: [

                        {

                            label:
                                "Savings",

                            data:
                                values,

                            borderColor:
                                "#7c3cff",

                            backgroundColor:
                                "rgba(124,60,255,0.12)",

                            borderWidth:
                                3,

                            pointRadius:
                                5,

                            pointBackgroundColor:
                                "#7c3cff",

                            tension:
                                0.35,

                            fill:
                                true

                        }

                    ]

                },


                options: {

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {

                            display:
                                false

                        },

                        tooltip: {

                            callbacks: {

                                label:
                                    context =>
                                        " " +
                                        formatRupees(
                                            context.raw
                                        )

                            }

                        }

                    },


                    scales: {

                        y: {

                            beginAtZero:
                                true,

                            ticks: {

                                color:
                                    "#8e96b4",

                                callback:
                                    value =>
                                        "₹" +
                                        Number(
                                            value
                                        ).toLocaleString(
                                            "en-IN"
                                        )

                            },

                            grid: {

                                color:
                                    "rgba(255,255,255,0.06)"

                            }

                        },


                        x: {

                            ticks: {

                                color:
                                    "#8e96b4"

                            },

                            grid: {

                                display:
                                    false

                            }

                        }

                    }

                }

            }
        );

}


/* ============================================================
   ADD SAVINGS BUTTON
============================================================ */

document
    .getElementById(
        "addSavingsButton"
    )
    ?.addEventListener(
        "click",
        function () {

            if (
                savingsGoals.length === 0
            ) {

                openSavingsGoalModal();

            } else {

                openAddSavingsModal();

            }

        }
    );


/* ============================================================
   CLOSE ALL MODALS ON PAGE LOAD
   ============================================================ */

document.addEventListener("DOMContentLoaded", function () {

    const editModal =
        document.getElementById("editModal");

    const deleteModal =
        document.getElementById("deleteModal");

    const savingsGoalModal =
        document.getElementById("savingsGoalModal");

    const addSavingsModal =
        document.getElementById("addSavingsModal");


    if (editModal) {
        editModal.classList.add("hidden");
        editModal.classList.remove("show");
    }

    if (deleteModal) {
        deleteModal.classList.add("hidden");
        deleteModal.classList.remove("show");
    }

    if (savingsGoalModal) {
        savingsGoalModal.classList.add("hidden");
        savingsGoalModal.classList.remove("show");
    }

    if (addSavingsModal) {
        addSavingsModal.classList.add("hidden");
        addSavingsModal.classList.remove("show");
    }

});
