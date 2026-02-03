import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Language = "en" | "fr";

type TranslationKey = 
  | "home" | "expenses" | "goals" | "family" | "shared" | "settings"
  | "signOut" | "profile" | "language" | "english" | "french"
  | "spendingBreakdown" | "recentActivity" | "viewAll" | "totalSpent"
  | "thisMonth" | "thisWeek" | "topGoal" | "noGoalsYet" | "setGoal"
  | "noTransactions" | "save" | "cancel" | "edit" | "delete"
  | "profileName" | "profileImage" | "changeImage" | "settingsTitle"
  | "spendingReflections" | "weeklyReflections" | "monthlyReflections"
  | "spentThisWeek" | "spentThisMonth" | "topCategory" | "noData"
  | "viewSpendingReflections" | "financialSnapshot" | "hi"
  | "priority" | "daysLeft" | "dueToday" | "viewAllGoals" | "categoryDetails"
  | "profileUpdated" | "changesSaved" | "error" | "failedToUpdate" | "yourName"
  | "imageUrlPlaceholder" | "currency" | "scanReceipt" | "scanning" | "confirmDetails"
  | "extractedFromReceipt" | "useThisData" | "tryAgain"
  | "selectCurrency" | "currencyPromptMessage" | "confirmCurrency"
  | "dangerZone" | "deleteAccountWarning" | "deleteAccount" | "confirmDeleteAccount"
  | "deleteAccountPermanent" | "typeDeleteToConfirm" | "deleteAccountPermanently"
  | "accountDeleted" | "accountDeletedMessage" | "failedToDeleteAccount"
  | "expenseCategories" | "customizeCategoriesDescription" | "newCategoryPlaceholder"
  | "categories" | "resetToDefault" | "categoriesUpdated" | "customizeCategoriesHint"
  | "paidWith" | "myMoney" | "familyMoney" | "reports" | "monthlyReport" | "weeklyReport"
  | "viewReports" | "noExpensesInPeriod" | "allCategories" | "backToReports"
  | "previousMonth" | "nextMonth" | "previousWeek" | "nextWeek" | "expensesInCategory"
  | "expense" | "expensesPlural" | "personal" | "familyBadge"
  | "familyDashboard" | "members" | "month" | "week" | "sharedSpending"
  | "moneySourceSplit" | "familyMoneySource" | "personalMoneySource"
  | "noSharedExpenses" | "backToCategories" | "noExpensesInCategory"
  | "spendingByCategory" | "familyGoals" | "recentSharedExpenses";

const translations: Record<Language, Record<TranslationKey, string>> = {
  en: {
    home: "Home",
    expenses: "Expenses",
    goals: "Goals",
    family: "Family",
    shared: "Shared",
    settings: "Settings",
    signOut: "Sign Out",
    profile: "Profile",
    language: "Language",
    english: "English",
    french: "French",
    spendingBreakdown: "Spending Breakdown",
    recentActivity: "Recent Activity",
    viewAll: "View All",
    totalSpent: "Total Spent",
    thisMonth: "this month",
    thisWeek: "this week",
    topGoal: "Top Goal",
    noGoalsYet: "No savings goals yet",
    setGoal: "Set a Goal",
    noTransactions: "No transactions found.",
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    delete: "Delete",
    profileName: "Display Name",
    profileImage: "Profile Image",
    changeImage: "Change Image",
    settingsTitle: "Settings",
    spendingReflections: "Spending Reflections",
    weeklyReflections: "Weekly Summary",
    monthlyReflections: "Monthly Summary",
    spentThisWeek: "Spent This Week",
    spentThisMonth: "Spent This Month",
    topCategory: "Top Category",
    noData: "No spending data yet.",
    viewSpendingReflections: "View Spending Reflections",
    financialSnapshot: "Here's your financial snapshot.",
    hi: "Hi",
    priority: "Priority",
    daysLeft: "days left",
    dueToday: "Due today!",
    viewAllGoals: "View All Goals",
    categoryDetails: "Category Details",
    profileUpdated: "Profile updated",
    changesSaved: "Your changes have been saved.",
    error: "Error",
    failedToUpdate: "Failed to update profile.",
    yourName: "Your name",
    imageUrlPlaceholder: "Image URL (optional)",
    currency: "Currency",
    scanReceipt: "Scan Receipt",
    scanning: "Scanning...",
    confirmDetails: "Confirm Details",
    extractedFromReceipt: "Extracted from receipt",
    useThisData: "Use This Data",
    tryAgain: "Try Again",
    selectCurrency: "Select Your Currency",
    currencyPromptMessage: "Choose the currency you'll use for tracking expenses. You can change this anytime in Settings.",
    confirmCurrency: "Confirm Currency",
    dangerZone: "Danger Zone",
    deleteAccountWarning: "Once you delete your account, there is no going back. All your data will be permanently removed.",
    deleteAccount: "Delete Account",
    confirmDeleteAccount: "Delete Your Account?",
    deleteAccountPermanent: "This action cannot be undone. All your expenses, goals, and data will be permanently deleted.",
    typeDeleteToConfirm: 'Type "DELETE" to confirm:',
    deleteAccountPermanently: "Delete Account Permanently",
    accountDeleted: "Account Deleted",
    accountDeletedMessage: "Your account has been permanently deleted.",
    failedToDeleteAccount: "Failed to delete account. Please try again.",
    expenseCategories: "Expense Categories",
    customizeCategoriesDescription: "Customize the categories for tracking your expenses. Click a category to edit its name.",
    newCategoryPlaceholder: "Add new category...",
    categories: "categories",
    resetToDefault: "Reset to Default",
    categoriesUpdated: "Categories Updated",
    customizeCategoriesHint: "Customize categories in Settings",
    paidWith: "Paid With",
    myMoney: "My Money",
    familyMoney: "Family Money",
    reports: "Reports",
    monthlyReport: "Monthly Report",
    weeklyReport: "Weekly Report",
    viewReports: "View Reports",
    noExpensesInPeriod: "No expenses in this period",
    allCategories: "All Categories",
    backToReports: "Back to Reports",
    previousMonth: "Previous Month",
    nextMonth: "Next Month",
    previousWeek: "Previous Week",
    nextWeek: "Next Week",
    expensesInCategory: "Expenses in",
    expense: "expense",
    expensesPlural: "expenses",
    personal: "Personal",
    familyBadge: "Family",
    familyDashboard: "Family Dashboard",
    members: "members",
    month: "Month",
    week: "Week",
    sharedSpending: "Shared Spending",
    moneySourceSplit: "Money Source Split",
    familyMoneySource: "Family Money",
    personalMoneySource: "Personal Money",
    noSharedExpenses: "No shared expenses yet",
    backToCategories: "Back to Categories",
    noExpensesInCategory: "No expenses in this category",
    spendingByCategory: "Spending by Category",
    familyGoals: "Family Goals",
    recentSharedExpenses: "Recent Shared Expenses",
  },
  fr: {
    home: "Accueil",
    expenses: "Dépenses",
    goals: "Objectifs",
    family: "Famille",
    shared: "Partagé",
    settings: "Paramètres",
    signOut: "Déconnexion",
    profile: "Profil",
    language: "Langue",
    english: "Anglais",
    french: "Français",
    spendingBreakdown: "Répartition des dépenses",
    recentActivity: "Activité récente",
    viewAll: "Voir tout",
    totalSpent: "Total dépensé",
    thisMonth: "ce mois",
    thisWeek: "cette semaine",
    topGoal: "Objectif principal",
    noGoalsYet: "Pas encore d'objectifs d'épargne",
    setGoal: "Définir un objectif",
    noTransactions: "Aucune transaction trouvée.",
    save: "Enregistrer",
    cancel: "Annuler",
    edit: "Modifier",
    delete: "Supprimer",
    profileName: "Nom d'affichage",
    profileImage: "Image de profil",
    changeImage: "Changer l'image",
    settingsTitle: "Paramètres",
    spendingReflections: "Réflexions sur les dépenses",
    weeklyReflections: "Résumé hebdomadaire",
    monthlyReflections: "Résumé mensuel",
    spentThisWeek: "Dépensé cette semaine",
    spentThisMonth: "Dépensé ce mois",
    topCategory: "Catégorie principale",
    noData: "Pas encore de données de dépenses.",
    viewSpendingReflections: "Voir les réflexions sur les dépenses",
    financialSnapshot: "Voici votre aperçu financier.",
    hi: "Bonjour",
    priority: "Priorité",
    daysLeft: "jours restants",
    dueToday: "Échéance aujourd'hui!",
    viewAllGoals: "Voir tous les objectifs",
    categoryDetails: "Détails par catégorie",
    profileUpdated: "Profil mis à jour",
    changesSaved: "Vos modifications ont été enregistrées.",
    error: "Erreur",
    failedToUpdate: "Impossible de mettre à jour le profil.",
    yourName: "Votre nom",
    imageUrlPlaceholder: "URL de l'image (optionnel)",
    currency: "Devise",
    scanReceipt: "Scanner le reçu",
    scanning: "Numérisation...",
    confirmDetails: "Confirmer les détails",
    extractedFromReceipt: "Extrait du reçu",
    useThisData: "Utiliser ces données",
    tryAgain: "Réessayer",
    selectCurrency: "Sélectionnez votre devise",
    currencyPromptMessage: "Choisissez la devise que vous utiliserez pour suivre vos dépenses. Vous pouvez la modifier à tout moment dans les Paramètres.",
    confirmCurrency: "Confirmer la devise",
    dangerZone: "Zone de danger",
    deleteAccountWarning: "Une fois votre compte supprimé, il n'y a pas de retour en arrière. Toutes vos données seront définitivement supprimées.",
    deleteAccount: "Supprimer le compte",
    confirmDeleteAccount: "Supprimer votre compte?",
    deleteAccountPermanent: "Cette action est irréversible. Toutes vos dépenses, objectifs et données seront définitivement supprimés.",
    typeDeleteToConfirm: 'Tapez "DELETE" pour confirmer:',
    deleteAccountPermanently: "Supprimer le compte définitivement",
    accountDeleted: "Compte supprimé",
    accountDeletedMessage: "Votre compte a été définitivement supprimé.",
    failedToDeleteAccount: "Échec de la suppression du compte. Veuillez réessayer.",
    expenseCategories: "Catégories de dépenses",
    customizeCategoriesDescription: "Personnalisez les catégories pour suivre vos dépenses. Cliquez sur une catégorie pour modifier son nom.",
    newCategoryPlaceholder: "Ajouter une catégorie...",
    categories: "catégories",
    resetToDefault: "Réinitialiser",
    categoriesUpdated: "Catégories mises à jour",
    customizeCategoriesHint: "Personnalisez les catégories dans Paramètres",
    paidWith: "Payé avec",
    myMoney: "Mon argent",
    familyMoney: "Argent familial",
    reports: "Rapports",
    monthlyReport: "Rapport mensuel",
    weeklyReport: "Rapport hebdomadaire",
    viewReports: "Voir les rapports",
    noExpensesInPeriod: "Aucune dépense pour cette période",
    allCategories: "Toutes les catégories",
    backToReports: "Retour aux rapports",
    previousMonth: "Mois précédent",
    nextMonth: "Mois suivant",
    previousWeek: "Semaine précédente",
    nextWeek: "Semaine suivante",
    expensesInCategory: "Dépenses en",
    expense: "dépense",
    expensesPlural: "dépenses",
    personal: "Personnel",
    familyBadge: "Famille",
    familyDashboard: "Tableau de bord familial",
    members: "membres",
    month: "Mois",
    week: "Semaine",
    sharedSpending: "Dépenses partagées",
    moneySourceSplit: "Répartition des sources",
    familyMoneySource: "Argent familial",
    personalMoneySource: "Argent personnel",
    noSharedExpenses: "Pas encore de dépenses partagées",
    backToCategories: "Retour aux catégories",
    noExpensesInCategory: "Aucune dépense dans cette catégorie",
    spendingByCategory: "Dépenses par catégorie",
    familyGoals: "Objectifs familiaux",
    recentSharedExpenses: "Dépenses partagées récentes",
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  isUpdating: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [language, setLanguageState] = useState<Language>((user?.language as Language) || "en");

  const updateLanguageMutation = useMutation({
    mutationFn: async (newLang: Language) => {
      const res = await apiRequest("PATCH", "/api/user/profile", { language: newLang });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
  });

  useEffect(() => {
    if (user?.language && user.language !== language) {
      setLanguageState(user.language as Language);
    }
  }, [user?.language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (user) {
      updateLanguageMutation.mutate(lang);
    }
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isUpdating: updateLanguageMutation.isPending }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
