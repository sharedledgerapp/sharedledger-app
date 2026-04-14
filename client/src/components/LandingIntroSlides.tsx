import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { captureEvent } from "@/lib/analytics";
import {
  Users, Wallet, PieChart, Trophy, Bell,
  ChevronRight, ChevronLeft, X, Download,
  CheckCircle2, Smartphone, ShieldCheck, Sparkles,
  ArrowRight, Globe, RefreshCw, Home, UserPlus, Layers, Star,
  DollarSign, LayoutDashboard, Receipt,
} from "lucide-react";
import { SiApple, SiAndroid } from "react-icons/si";

/* ─── Language type ─── */
type Lang = "en" | "fr" | "nl";

/* ─── All slide translations ─── */
const T = {
  en: {
    nav: { skip: "Skip", next: "Next", installedIt: "I've installed it" },

    s1: {
      question: "Have you ever looked at your balance and wondered where it all went?",
      answer: "Your transactions are all there, but they don't explain how you got there.",
      clarityLabel: "SharedLedger gives you clarity:",
      points: [
        "Spending broken down by category and week",
        "Patterns you can see and act on",
        "No spreadsheets. No forgotten updates.",
      ],
      betaNote: "Currently in beta testing, free to use and actively improved",
    },

    s2: {
      statement: "Money is rarely just personal.",
      bankLabel: "Your bank",
      bankDesc: "Shows your transactions. Your side only.",
      slLabel: "SharedLedger",
      slDesc: "Shows the full household picture, together.",
      body: "SharedLedger gives you and your household a shared financial snapshot: who spent what, how you're tracking together, one clear view for everyone.",
      soloNote: "Works solo from day one. Add your household whenever you're ready.",
    },

    s3: {
      title: "Who is it for?",
      subtitle: "You don't need a group to start. Use it solo and invite others later.",
      groups: [
        { name: "Families",   desc: "Household budgets, shared costs, and goals everyone can see" },
        { name: "Couples",    desc: "See who spent what, track shared goals, settle up easily" },
        { name: "Roommates",  desc: "Split bills, shared expenses, and a clear view of who owes what" },
        { name: "Solo users", desc: "Personal finance without needing a group. Start alone, expand later." },
      ],
    },

    s4: {
      title: "What you can do",
      subtitle: "Everything to understand and manage your money",
      features: [
        "Log everyday expenses or scan a receipt to fill in the details",
        "Track income alongside spending for a complete monthly picture",
        "Visual spending breakdowns by category, week, or month",
        "Set budgets with colour-coded alerts and track savings goals",
        "Switch between your personal view and your household's shared dashboard",
      ],
      sageLine: "Plus Sage AI, your built-in financial advisor. More on that next.",
    },

    s5: {
      badge: "Beta feature · Powered by Gemini · Still in testing",
      title: "Meet",
      highlight: "Sage",
      roleLabel: "Your AI accountant. Your financial advisor.",
      subtitle: "Sage is built into SharedLedger and reads your actual spending data. It sees the patterns, understands your context, and helps you know what to do next.",
      whatTitle: "What Sage does for you",
      bullets: [
        "Acts as your personal accountant: knows your numbers, categories, and history",
        "Spots patterns in your spending before they become problems",
        "Delivers monthly and mid-month reviews with honest, clear observations",
        "Answers questions about your money in plain language, any time",
      ],
      disclaimer: "Sage is still being improved. Responses are based on your data, but always double-check important financial decisions.",
    },

    s6: {
      title: "You enter your own expenses",
      subtitleBefore: "There is currently ",
      subtitleCircled: "no bank connection",
      subtitleAfter: ". You log what you spend yourself.",
      whyTitle: "Why this works well in practice:",
      bullets: [
        "Your bank credentials never leave your device",
        "No third-party access to your accounts",
        "Logging expenses manually builds real awareness of your spending",
        "Receipt scanning makes it quick to log on the go",
      ],
      comingTitle: "Coming later:",
      comingNote: "Optional bank account linking will be added as a feature. It will always be your choice whether to use it. Privacy remains central to how SharedLedger works.",
    },

    s7: {
      title: "Why it's not in the App Store",
      subtitleBefore: "SharedLedger is a ",
      subtitleHighlight: "Progressive Web App",
      subtitleAfter: ". It installs from your browser, not an app store.",
      benefits: [
        { title: "Instant updates",             desc: "Fixes and new features ship immediately, no waiting for store approval" },
        { title: "Feels like a native app",      desc: "Sits on your home screen and works offline, just like a regular app" },
        { title: "No account needed to install", desc: "Install directly from your browser. No App Store login required." },
      ],
      footer: "We'll submit to the App Store once the app graduates from beta. The next slide shows you how to install it today.",
    },

    s8: {
      title: "Add it to your home screen",
      subtitle: "Select your phone type to see the steps",
      alreadyTitle: "You're all set!",
      alreadyNote: "SharedLedger is already installed on your home screen. Tap \"Next\" to continue.",
      inAppTitle: "You're not in Safari right now",
      inAppNote: "The \"Add to Home Screen\" option only appears in Safari. Open this page in Safari first.",
      copyLink: "Copy link to open in Safari",
      selectDevice: "Select your device above to see the steps",
      iosLabel: "iPhone",
      androidLabel: "Android",
      iosSteps: [
        { text: "Open sharedledger.app in Safari",                            note: "Not Chrome, WhatsApp, or Instagram — those won't show the install option",  warn: true },
        { text: "Tap the Share button (□↑) at the bottom of the screen",      note: "Scroll up slightly if you can't see the toolbar",                           warn: false },
        { text: "Scroll down the share sheet and tap \"Add to Home Screen\"",  note: null, warn: false },
        { text: "Tap \"Add\" — the app appears on your home screen",           note: null, warn: false },
      ],
      androidSteps: [
        { text: "Open sharedledger.app in Chrome",                               note: null, warn: false },
        { text: "Tap the three-dot menu (⋮) in the top-right corner",            note: null, warn: false },
        { text: "Tap \"Add to Home Screen\" or \"Install app\"",                 note: null, warn: false },
        { text: "Tap \"Add\" — it appears on your home screen",                  note: null, warn: false },
      ],
    },

    s9: {
      title: "You're ready to start",
      subtitle: "Follow this order for the smoothest experience",
      steps: [
        { title: "Install the app",     desc: "Add it to your home screen from the previous step. Takes under 30 seconds." },
        { title: "Create your account", desc: "Sign up inside the installed app. No email verification needed." },
        { title: "Start tracking",      desc: "Add your first expense. Invite your household whenever you're ready." },
      ],
      btnInstall: "How to Install the App",
      btnOpen: "Already installed? Open the App",
      btnMore: "Continue to learn more about SharedLedger",
    },
  },

  /* ════════════════════════════════════════ FRENCH ════════════════════════════════════════ */
  fr: {
    nav: { skip: "Passer", next: "Suivant", installedIt: "C'est installé" },

    s1: {
      question: "Avez-vous déjà regardé votre solde en vous demandant où tout est passé ?",
      answer: "Vos transactions sont toutes là, mais elles n'expliquent pas comment vous en êtes arrivé là.",
      clarityLabel: "SharedLedger vous apporte la clarté :",
      points: [
        "Dépenses détaillées par catégorie et par semaine",
        "Des tendances que vous pouvez voir et sur lesquelles agir",
        "Pas de tableurs. Pas de mises à jour oubliées.",
      ],
      betaNote: "En bêta, gratuit et en amélioration continue",
    },

    s2: {
      statement: "L'argent est rarement qu'une affaire personnelle.",
      bankLabel: "Votre banque",
      bankDesc: "Montre vos transactions. Votre côté seulement.",
      slLabel: "SharedLedger",
      slDesc: "Montre l'image complète du foyer, ensemble.",
      body: "SharedLedger vous offre, à vous et votre foyer, un aperçu financier partagé : qui a dépensé quoi, comment vous progressez ensemble, une vue claire pour tous.",
      soloNote: "Fonctionne en solo dès le premier jour. Invitez votre foyer quand vous êtes prêt.",
    },

    s3: {
      title: "Pour qui ?",
      subtitle: "Pas besoin d'un groupe pour commencer. Utilisez-le seul et invitez d'autres plus tard.",
      groups: [
        { name: "Familles",           desc: "Budgets du foyer, dépenses partagées, et objectifs visibles par tous" },
        { name: "Couples",            desc: "Voyez qui a dépensé quoi, suivez vos objectifs communs, réglez facilement" },
        { name: "Colocataires",       desc: "Partagez les factures, les dépenses communes, et sachez qui doit quoi" },
        { name: "Utilisateurs solos", desc: "Finances personnelles sans groupe. Commencez seul, élargissez plus tard." },
      ],
    },

    s4: {
      title: "Ce que vous pouvez faire",
      subtitle: "Tout pour comprendre et gérer votre argent",
      features: [
        "Notez vos dépenses ou scannez un reçu pour remplir les détails automatiquement",
        "Suivez vos revenus et dépenses pour une vue mensuelle complète",
        "Répartition visuelle des dépenses par catégorie, semaine ou mois",
        "Définissez des budgets avec alertes et suivez vos objectifs d'épargne",
        "Passez de votre vue personnelle au tableau de bord partagé de votre ménage",
      ],
      sageLine: "Plus Sage IA, votre conseiller financier intégré. Détails à la prochaine diapo.",
    },

    s5: {
      badge: "Fonctionnalité bêta · Propulsé par Gemini · En cours de test",
      title: "Rencontrez",
      highlight: "Sage",
      roleLabel: "Votre comptable IA. Votre conseiller financier.",
      subtitle: "Sage est intégré à SharedLedger et lit vos données réelles de dépenses. Il voit les tendances, comprend votre contexte et vous aide à savoir ce que vous devez faire ensuite.",
      whatTitle: "Ce que Sage fait pour vous",
      bullets: [
        "Agit comme votre comptable personnel : connaît vos chiffres, catégories et historique",
        "Repère les tendances dans vos dépenses avant qu'elles ne deviennent des problèmes",
        "Génère des bilans mensuels et à mi-mois avec des observations honnêtes et claires",
        "Répond à vos questions sur votre argent en langage clair, à tout moment",
      ],
      disclaimer: "Sage est encore en amélioration. Les réponses sont basées sur vos données, mais vérifiez toujours les décisions financières importantes.",
    },

    s6: {
      title: "Vous saisissez vos propres dépenses",
      subtitleBefore: "Il n'y a actuellement ",
      subtitleCircled: "pas de connexion bancaire",
      subtitleAfter: ". Vous enregistrez vous-même vos dépenses.",
      whyTitle: "Pourquoi cela fonctionne bien en pratique :",
      bullets: [
        "Vos identifiants bancaires ne quittent jamais votre appareil",
        "Aucun accès tiers à vos comptes",
        "Saisir manuellement les dépenses développe une vraie conscience de votre budget",
        "Le scan de reçus permet de noter rapidement en déplacement",
      ],
      comingTitle: "Bientôt :",
      comingNote: "La connexion optionnelle à un compte bancaire sera ajoutée comme fonctionnalité. Ce sera toujours votre choix. La confidentialité reste au cœur de SharedLedger.",
    },

    s7: {
      title: "Pourquoi ce n'est pas dans l'App Store",
      subtitleBefore: "SharedLedger est une ",
      subtitleHighlight: "Progressive Web App",
      subtitleAfter: ". Elle s'installe depuis votre navigateur, pas un app store.",
      benefits: [
        { title: "Mises à jour instantanées",   desc: "Corrections et nouvelles fonctionnalités disponibles immédiatement, sans attendre l'approbation d'un store" },
        { title: "Comme une appli native",       desc: "S'installe sur votre écran d'accueil et fonctionne hors ligne, comme une vraie appli" },
        { title: "Pas besoin de compte",         desc: "Installez directement depuis votre navigateur. Pas besoin de compte App Store." },
      ],
      footer: "Nous soumettrons à l'App Store une fois l'appli sortie de bêta. La prochaine diapo vous montre comment l'installer aujourd'hui.",
    },

    s8: {
      title: "Ajoutez-la à votre écran d'accueil",
      subtitle: "Sélectionnez votre type de téléphone pour voir les étapes",
      alreadyTitle: "Vous êtes prêt !",
      alreadyNote: "SharedLedger est déjà installé sur votre écran d'accueil. Appuyez sur « Suivant » pour continuer.",
      inAppTitle: "Vous n'êtes pas dans Safari",
      inAppNote: "L'option « Ajouter à l'écran d'accueil » n'apparaît que dans Safari. Ouvrez cette page dans Safari d'abord.",
      copyLink: "Copier le lien pour ouvrir dans Safari",
      selectDevice: "Sélectionnez votre appareil ci-dessus pour voir les étapes",
      iosLabel: "iPhone",
      androidLabel: "Android",
      iosSteps: [
        { text: "Ouvrez sharedledger.app dans Safari",                           note: "Pas Chrome, WhatsApp ou Instagram — ils ne montrent pas l'option d'installation", warn: true },
        { text: "Appuyez sur le bouton Partager (□↑) en bas de l'écran",        note: "Faites défiler vers le haut si vous ne voyez pas la barre d'outils",             warn: false },
        { text: "Faites défiler et appuyez sur « Sur l'écran d'accueil »",       note: null, warn: false },
        { text: "Appuyez sur « Ajouter » — l'appli apparaît sur votre écran d'accueil", note: null, warn: false },
      ],
      androidSteps: [
        { text: "Ouvrez sharedledger.app dans Chrome",                           note: null, warn: false },
        { text: "Appuyez sur le menu à trois points (⋮) en haut à droite",      note: null, warn: false },
        { text: "Appuyez sur « Ajouter à l'écran d'accueil » ou « Installer »", note: null, warn: false },
        { text: "Appuyez sur « Ajouter » — elle apparaît sur votre écran d'accueil", note: null, warn: false },
      ],
    },

    s9: {
      title: "Vous êtes prêt à commencer",
      subtitle: "Suivez cet ordre pour une expérience optimale",
      steps: [
        { title: "Installer l'appli",    desc: "Ajoutez-la à votre écran d'accueil à l'étape précédente. Moins de 30 secondes." },
        { title: "Créer votre compte",   desc: "Inscrivez-vous dans l'appli installée. Pas besoin de vérification par email." },
        { title: "Commencer à suivre",   desc: "Ajoutez votre première dépense. Invitez votre ménage quand vous êtes prêt." },
      ],
      btnInstall: "Comment installer l'appli",
      btnOpen: "Déjà installé ? Ouvrir l'appli",
      btnMore: "Continuer pour en savoir plus sur SharedLedger",
    },
  },

  /* ════════════════════════════════════════ DUTCH ════════════════════════════════════════ */
  nl: {
    nav: { skip: "Overslaan", next: "Volgende", installedIt: "Ik heb het geïnstalleerd" },

    s1: {
      question: "Heb je ooit naar je saldo gekeken en je afgevraagd waar het allemaal naartoe is gegaan?",
      answer: "Je transacties staan er allemaal, maar ze verklaren niet hoe je daar bent gekomen.",
      clarityLabel: "SharedLedger geeft je duidelijkheid:",
      points: [
        "Uitgaven uitgesplitst per categorie en per week",
        "Patronen die je kunt zien en waarop je kunt handelen",
        "Geen spreadsheets. Geen vergeten updates.",
      ],
      betaNote: "Momenteel in bèta, gratis en actief verbeterd",
    },

    s2: {
      statement: "Geld is zelden alleen jouw zaak.",
      bankLabel: "Je bank",
      bankDesc: "Toont jouw transacties. Alleen jouw kant.",
      slLabel: "SharedLedger",
      slDesc: "Toont het volledige beeld van je huishouden.",
      body: "SharedLedger geeft jou en je huishouden een gedeeld financieel overzicht: wie wat heeft uitgegeven, hoe jullie er samen voor staan, één helder beeld voor iedereen.",
      soloNote: "Werkt solo vanaf dag één. Voeg je huishouden toe wanneer je er klaar voor bent.",
    },

    s3: {
      title: "Voor wie is het?",
      subtitle: "Je hebt geen groep nodig om te starten. Gebruik het solo en nodig anderen later uit.",
      groups: [
        { name: "Gezinnen",        desc: "Huishoudbudgetten, gedeelde kosten en doelen die iedereen kan zien" },
        { name: "Koppels",         desc: "Bekijk wie wat heeft uitgegeven, volg gezamenlijke doelen, vereken eenvoudig" },
        { name: "Huisgenoten",     desc: "Verdeel rekeningen, deel uitgaven, en zie duidelijk wie wat verschuldigd is" },
        { name: "Solo-gebruikers", desc: "Persoonlijke financiën zonder groep. Begin alleen, breid later uit." },
      ],
    },

    s4: {
      title: "Wat je kunt doen",
      subtitle: "Alles om je geld te begrijpen en te beheren",
      features: [
        "Log dagelijkse uitgaven of scan een bon voor automatisch invullen",
        "Volg inkomsten naast uitgaven voor een volledig maandoverzicht",
        "Visuele uitgavenverdelingen per categorie, week of maand",
        "Stel budgetten in met kleurgecodeerde meldingen en volg spaardoelen",
        "Schakel tussen je persoonlijke weergave en het gedeelde dashboard van je huishouden",
      ],
      sageLine: "Plus Sage AI, je ingebouwde financieel adviseur. Meer daarover in de volgende dia.",
    },

    s5: {
      badge: "Bètafunctie · Aangedreven door Gemini · Nog in testen",
      title: "Maak kennis met",
      highlight: "Sage",
      roleLabel: "Je AI-accountant. Je financieel adviseur.",
      subtitle: "Sage is ingebouwd in SharedLedger en leest je werkelijke uitgavengegevens. Het ziet de patronen, begrijpt jouw context en helpt je begrijpen wat je als volgende stap kunt doen.",
      whatTitle: "Wat Sage voor je doet",
      bullets: [
        "Fungeert als je persoonlijke accountant: kent je cijfers, categorieën en geschiedenis",
        "Herkent patronen in je uitgaven voordat ze problemen worden",
        "Levert maandelijkse en tussentijdse reviews met eerlijke, duidelijke observaties",
        "Beantwoordt vragen over je geld in begrijpelijke taal, op elk moment",
      ],
      disclaimer: "Sage wordt nog verbeterd. Antwoorden zijn gebaseerd op je gegevens, maar controleer altijd belangrijke financiële beslissingen.",
    },

    s6: {
      title: "Jij voert je eigen uitgaven in",
      subtitleBefore: "Er is momenteel ",
      subtitleCircled: "geen bankkoppeling",
      subtitleAfter: ". Je logt wat je uitgeeft zelf.",
      whyTitle: "Waarom dit goed werkt in de praktijk:",
      bullets: [
        "Je bankgegevens verlaten je apparaat nooit",
        "Geen toegang van derden tot je rekeningen",
        "Handmatig invoeren bouwt echt bewustzijn van je uitgaven op",
        "Bonnetjes scannen maakt snel invoeren onderweg mogelijk",
      ],
      comingTitle: "Binnenkort:",
      comingNote: "Optionele bankkoppeling wordt later als functie toegevoegd. Het blijft altijd jouw keuze of je het gebruikt. Privacy blijft centraal in hoe SharedLedger werkt.",
    },

    s7: {
      title: "Waarom het niet in de App Store staat",
      subtitleBefore: "SharedLedger is een ",
      subtitleHighlight: "Progressive Web App",
      subtitleAfter: ". Je installeert het vanuit je browser, niet via een app store.",
      benefits: [
        { title: "Directe updates",                  desc: "Fixes en nieuwe functies zijn meteen beschikbaar, geen goedkeuring van een store nodig" },
        { title: "Voelt als een native app",          desc: "Staat op je startscherm en werkt offline, net als een gewone app" },
        { title: "Geen account nodig om te installeren", desc: "Installeer direct vanuit je browser. Geen App Store-account vereist." },
      ],
      footer: "We dienen in bij de App Store zodra de app de bètafase verlaat. De volgende dia laat zien hoe je het vandaag installeert.",
    },

    s8: {
      title: "Voeg het toe aan je startscherm",
      subtitle: "Selecteer je telefoontype om de stappen te zien",
      alreadyTitle: "Je bent klaar!",
      alreadyNote: "SharedLedger staat al op je startscherm. Tik op 'Volgende' om door te gaan.",
      inAppTitle: "Je zit niet in Safari",
      inAppNote: "De optie 'Voeg toe aan startscherm' verschijnt alleen in Safari. Open deze pagina eerst in Safari.",
      copyLink: "Link kopiëren om in Safari te openen",
      selectDevice: "Selecteer je apparaat hierboven om de stappen te zien",
      iosLabel: "iPhone",
      androidLabel: "Android",
      iosSteps: [
        { text: "Open sharedledger.app in Safari",                              note: "Niet Chrome, WhatsApp of Instagram — die tonen de installatieoptie niet", warn: true },
        { text: "Tik op de knop Delen (□↑) onderaan het scherm",               note: "Scroll iets omhoog als je de werkbalk niet ziet",                       warn: false },
        { text: "Scroll in het deelmenu en tik op 'Zet op beginscherm'",        note: null, warn: false },
        { text: "Tik op 'Voeg toe' — de app verschijnt op je startscherm",      note: null, warn: false },
      ],
      androidSteps: [
        { text: "Open sharedledger.app in Chrome",                              note: null, warn: false },
        { text: "Tik op het menu met drie puntjes (⋮) rechts bovenin",         note: null, warn: false },
        { text: "Tik op 'Toevoegen aan startscherm' of 'App installeren'",      note: null, warn: false },
        { text: "Tik op 'Toevoegen' — de app verschijnt op je startscherm",     note: null, warn: false },
      ],
    },

    s9: {
      title: "Je bent klaar om te beginnen",
      subtitle: "Volg deze volgorde voor de beste ervaring",
      steps: [
        { title: "De app installeren",     desc: "Voeg het toe aan je startscherm via de vorige stap. Duurt minder dan 30 seconden." },
        { title: "Je account aanmaken",    desc: "Meld je aan in de geïnstalleerde app. Geen e-mailverificatie nodig." },
        { title: "Beginnen bij te houden", desc: "Voeg je eerste uitgave toe. Nodig je huishouden uit wanneer je er klaar voor bent." },
      ],
      btnInstall: "Hoe de app te installeren",
      btnOpen: "Al geïnstalleerd? Open de app",
      btnMore: "Ga verder om meer te leren over SharedLedger",
    },
  },
} satisfies Record<Lang, unknown>;

/* ─── Practical (merged no-bank + PWA) slide content ─── */
const PRACTICAL = {
  en: {
    title: "A few things worth knowing",
    noBank: "No bank connection",
    noBankDesc: "You enter your own transactions. Your banking credentials never leave your device. Receipt scanning makes quick logging easy on the go.",
    noBankComing: "Optional bank linking is planned for later. It will always be your choice.",
    pwa: "Not in the App Store — yet",
    pwaDesc: "SharedLedger is a web app that installs straight from your browser. No App Store account needed, and you always have the latest version the moment we push it.",
    pwaNote: "We'll submit to the App Store once we graduate from beta.",
  },
  fr: {
    title: "Quelques choses à savoir",
    noBank: "Pas de connexion bancaire",
    noBankDesc: "Vous saisissez vos propres transactions. Vos identifiants bancaires ne quittent jamais votre appareil. Le scan de reçus facilite la saisie en déplacement.",
    noBankComing: "La connexion bancaire optionnelle est prévue pour plus tard. Ce sera toujours votre choix.",
    pwa: "Pas encore dans l'App Store",
    pwaDesc: "SharedLedger est une web app qui s'installe directement depuis votre navigateur. Pas besoin de compte App Store, et vous avez toujours la dernière version dès qu'on la publie.",
    pwaNote: "Nous soumettrons à l'App Store à la sortie de la bêta.",
  },
  nl: {
    title: "Een paar dingen om te weten",
    noBank: "Geen bankkoppeling",
    noBankDesc: "Je voert je eigen transacties in. Je bankgegevens verlaten je apparaat nooit. Bonnetjes scannen maakt snelle invoer onderweg mogelijk.",
    noBankComing: "Optionele bankkoppeling is later gepland. Het blijft altijd jouw keuze.",
    pwa: "Nog niet in de App Store",
    pwaDesc: "SharedLedger is een web-app die direct vanuit je browser installeert. Geen App Store-account nodig, en je hebt altijd de nieuwste versie zodra we die uitrollen.",
    pwaNote: "We dienen in bij de App Store zodra we de bètafase verlaten.",
  },
} satisfies Record<Lang, unknown>;

/* ─── Device detection ─── */
function useDeviceState() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isChromeIOS = /CriOS/.test(ua);
  const isFirefoxIOS = /FxiOS/.test(ua);
  const isInApp = /(Instagram|FBAN|FBAV|WhatsApp|Snapchat|Twitter|LinkedIn)/i.test(ua);
  const isPWA =
    typeof window !== "undefined" && (window.navigator as any).standalone === true;
  const isNativeSafari = isIOS && !isChromeIOS && !isFirefoxIOS && !isInApp && !isPWA;
  return { isIOS, isAndroid, isChromeIOS, isInApp, isNativeSafari, isPWA };
}

/* ─── Animation helpers ─── */
function FadeUp({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div className={className} style={{ animation: `fade-up 0.5s ease-out ${delay}ms both` }}>
      {children}
    </div>
  );
}

function Highlight({ children, delay = 300 }: { children: React.ReactNode; delay?: number }) {
  return (
    <span className="relative inline">
      <span
        className="absolute inset-[-2px_-5px] bg-primary/15 rounded-md"
        style={{ animation: `highlight-pop 0.45s ease-out ${delay}ms both`, transformOrigin: "left center" }}
      />
      <span className="relative font-bold text-primary">{children}</span>
    </span>
  );
}

function Circled({ children, delay = 400 }: { children: React.ReactNode; delay?: number }) {
  return (
    <span className="relative inline-block">
      <svg
        className="absolute pointer-events-none"
        style={{ inset: "-3px -8px", width: "calc(100% + 16px)", height: "calc(100% + 6px)", overflow: "visible" }}
        viewBox="0 0 200 36"
        preserveAspectRatio="none"
      >
        <ellipse
          cx="100" cy="18" rx="95" ry="14"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="310"
          style={{ animation: `circle-draw 0.75s ease-out ${delay}ms both` }}
        />
      </svg>
      <span className="relative font-bold">{children}</span>
    </span>
  );
}

function SlideWrap({ children }: { children: React.ReactNode }) {
  return <div className="max-w-md mx-auto w-full flex flex-col gap-5 py-2">{children}</div>;
}

function SlideIcon({ icon: Icon, gradient = "from-primary to-accent", className = "" }: {
  icon: React.ElementType; gradient?: string; className?: string;
}) {
  return (
    <FadeUp delay={0}>
      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-tr ${gradient} flex items-center justify-center shadow-lg shadow-primary/20 mx-auto ${className}`}>
        <Icon className="w-8 h-8 text-white" />
      </div>
    </FadeUp>
  );
}

/* ══════════════════════════════════════ SLIDE 1 ══════════════════════════════════════ */
function Slide1({ lang }: { lang: Lang }) {
  const s = T[lang].s1;
  return (
    <SlideWrap>
      <FadeUp delay={0}>
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 mx-auto">
          <PieChart className="w-8 h-8 text-white" />
        </div>
      </FadeUp>

      {/* Rhetorical question — large, italic, quote-styled */}
      <FadeUp delay={100}>
        <div className="relative text-center px-1">
          <span
            className="absolute -top-3 left-0 text-6xl text-primary/20 font-serif leading-none select-none"
            aria-hidden="true"
          >"</span>
          <p className="font-display italic font-bold text-xl text-foreground leading-snug px-7 pt-1">
            {s.question}
          </p>
          <span
            className="absolute -bottom-5 right-0 text-6xl text-primary/20 font-serif leading-none select-none rotate-180"
            aria-hidden="true"
          >"</span>
        </div>
      </FadeUp>

      {/* Answer sentence */}
      <FadeUp delay={260}>
        <p className="text-center text-sm text-muted-foreground leading-relaxed px-2">
          {s.answer}
        </p>
      </FadeUp>

      {/* Clarity card */}
      <FadeUp delay={400}>
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">
            {s.clarityLabel}
          </p>
          <div className="space-y-2.5">
            {s.points.map((pt, i) => (
              <div key={i} className="flex items-center gap-3" style={{ animation: `fade-up 0.4s ease-out ${460 + i * 80}ms both` }}>
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-sm text-foreground">{pt}</span>
              </div>
            ))}
          </div>
        </div>
      </FadeUp>

      <FadeUp delay={700}>
        <p className="text-center text-xs text-muted-foreground italic">{s.betaNote}</p>
      </FadeUp>
    </SlideWrap>
  );
}

/* ══════════════════════════════════════ SLIDE 2 ══════════════════════════════════════ */
function Slide2({ lang }: { lang: Lang }) {
  const s = T[lang].s2;
  return (
    <SlideWrap>
      <SlideIcon icon={Users} />

      {/* Bold declaration */}
      <FadeUp delay={100} className="text-center">
        <h2 className="font-display font-bold text-3xl text-foreground leading-tight">
          {s.statement}
        </h2>
      </FadeUp>

      {/* Your bank vs SharedLedger comparison */}
      <FadeUp delay={220}>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/60 rounded-2xl border border-border/40 p-4 text-center">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5">
              {s.bankLabel}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">{s.bankDesc}</p>
          </div>
          <div className="bg-primary/8 rounded-2xl border border-primary/20 p-4 text-center">
            <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1.5">
              {s.slLabel}
            </p>
            <p className="text-xs text-foreground leading-relaxed">{s.slDesc}</p>
          </div>
        </div>
      </FadeUp>

      {/* Body */}
      <FadeUp delay={360}>
        <p className="text-sm text-muted-foreground text-center leading-relaxed px-1">
          {s.body}
        </p>
      </FadeUp>

      {/* Solo note — covers the "no group needed" message */}
      <FadeUp delay={480}>
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl border border-primary/20 p-4 text-center">
          <p className="text-sm font-semibold text-foreground">{s.soloNote}</p>
        </div>
      </FadeUp>
    </SlideWrap>
  );
}

/* ══════════════════════════════════════ SLIDE 3 ══════════════════════════════════════ */
const GROUP_ICONS = [Users, Star, Layers, Wallet];

function Slide3({ lang }: { lang: Lang }) {
  const s = T[lang].s3;
  return (
    <SlideWrap>
      <FadeUp delay={0} className="text-center">
        <h2 className="font-display font-bold text-3xl text-foreground leading-tight">{s.title}</h2>
        <p className="text-muted-foreground mt-2 text-sm">{s.subtitle}</p>
      </FadeUp>

      <div className="space-y-3">
        {s.groups.map(({ name, desc }, i) => {
          const Icon = GROUP_ICONS[i];
          const highlight = i === 3;
          return (
            <FadeUp key={name} delay={100 + i * 100}>
              <div className={`flex items-start gap-4 p-4 rounded-2xl border ${highlight ? "bg-primary/8 border-primary/25" : "bg-white dark:bg-card border-border/50"}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${highlight ? "bg-gradient-to-tr from-primary to-accent shadow-sm shadow-primary/20" : "bg-muted"}`}>
                  <Icon className={`w-5 h-5 ${highlight ? "text-white" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className={`font-semibold text-sm ${highlight ? "text-primary" : "text-foreground"}`}>{name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            </FadeUp>
          );
        })}
      </div>
    </SlideWrap>
  );
}

/* ══════════════════════════════════════ SLIDE 4 ══════════════════════════════════════ */
const FEATURE_ICONS = [Receipt, DollarSign, PieChart, LayoutDashboard, Trophy, RefreshCw, Bell];

function Slide4({ lang }: { lang: Lang }) {
  const s = T[lang].s4;
  return (
    <SlideWrap>
      <FadeUp delay={0} className="text-center">
        <h2 className="font-display font-bold text-3xl text-foreground">{s.title}</h2>
        <p className="text-muted-foreground mt-2 text-sm">{s.subtitle}</p>
      </FadeUp>

      <div className="grid grid-cols-1 gap-2">
        {s.features.map((text, i) => {
          const Icon = FEATURE_ICONS[i];
          return (
            <div
              key={i}
              className="flex items-center gap-3 bg-white dark:bg-card rounded-xl border border-border/50 px-4 py-3"
              style={{ animation: `fade-up 0.4s ease-out ${80 + i * 65}ms both` }}
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-accent flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm text-foreground leading-snug">{text}</span>
            </div>
          );
        })}
      </div>

      <FadeUp delay={560}>
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl border border-primary/20 p-4 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-primary shrink-0" />
          <p className="text-sm text-foreground">
            <span className="font-semibold">
              {lang === "en" ? "Plus Sage AI" : lang === "fr" ? "Plus Sage IA" : "Plus Sage AI"}
            </span>{" "}
            {s.sageLine.replace(/^Plus Sage (AI|IA),?\s*/i, "")}
          </p>
        </div>
      </FadeUp>
    </SlideWrap>
  );
}

/* ══════════════════════════════════════ SLIDE 5 ══════════════════════════════════════ */
function Slide5({ lang }: { lang: Lang }) {
  const s = T[lang].s5;
  return (
    <SlideWrap>
      <FadeUp delay={0}>
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-500 to-primary flex items-center justify-center shadow-lg shadow-primary/20 mx-auto">
          <Sparkles className="w-8 h-8 text-white animate-sparkle" />
        </div>
      </FadeUp>

      <FadeUp delay={100} className="text-center">
        <span className="inline-block text-xs font-semibold bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full mb-3">
          {s.badge}
        </span>
        <h2 className="font-display font-bold text-3xl text-foreground leading-tight">
          {s.title} <Highlight delay={400}>{s.highlight}</Highlight>
        </h2>
        {/* Role label — positioned as a strong subtitle under the name */}
        <p className="mt-2 text-sm font-semibold text-primary">{s.roleLabel}</p>
        <p className="text-muted-foreground mt-2 leading-relaxed text-sm">{s.subtitle}</p>
      </FadeUp>

      <FadeUp delay={280}>
        <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-3.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{s.whatTitle}</p>
          {s.bullets.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5"
              style={{ animation: `fade-up 0.4s ease-out ${340 + i * 80}ms both` }}
            >
              <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <span className="text-sm text-foreground leading-snug">{item}</span>
            </div>
          ))}
        </div>
      </FadeUp>

      <FadeUp delay={680}>
        <p className="text-xs text-muted-foreground text-center italic">{s.disclaimer}</p>
      </FadeUp>
    </SlideWrap>
  );
}

/* ══════════════════════════════════════ SLIDE PRACTICAL (merged 6+7) ════════════════ */
function SlidePractical({ lang }: { lang: Lang }) {
  const p = (PRACTICAL as Record<Lang, typeof PRACTICAL["en"]>)[lang];
  return (
    <SlideWrap>
      <FadeUp delay={0} className="text-center">
        <h2 className="font-display font-bold text-3xl text-foreground leading-tight">{p.title}</h2>
      </FadeUp>

      {/* No bank connection */}
      <FadeUp delay={120}>
        <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200/60 dark:border-amber-800/40 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <p className="font-semibold text-sm text-foreground">{p.noBank}</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{p.noBankDesc}</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-2.5 font-medium">{p.noBankComing}</p>
        </div>
      </FadeUp>

      {/* PWA / not in app store */}
      <FadeUp delay={260}>
        <div className="bg-card rounded-2xl border border-border/60 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <p className="font-semibold text-sm text-foreground">{p.pwa}</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{p.pwaDesc}</p>
          <p className="text-xs text-muted-foreground mt-2.5 italic">{p.pwaNote}</p>
        </div>
      </FadeUp>
    </SlideWrap>
  );
}

/* ══════════════════════════════════════ SLIDE 6 ══════════════════════════════════════ */
function Slide6({ lang }: { lang: Lang }) {
  const s = T[lang].s6;
  return (
    <SlideWrap>
      <FadeUp delay={0}>
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center shadow-lg shadow-amber-500/20 mx-auto">
          <ShieldCheck className="w-8 h-8 text-white" />
        </div>
      </FadeUp>

      <FadeUp delay={100} className="text-center">
        <h2 className="font-display font-bold text-3xl text-foreground leading-tight">{s.title}</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {s.subtitleBefore}
          <Circled delay={450}>{s.subtitleCircled}</Circled>
          {s.subtitleAfter}
        </p>
      </FadeUp>

      <FadeUp delay={280}>
        <div className="bg-white dark:bg-card rounded-2xl border border-border/50 p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">{s.whyTitle}</p>
          {s.bullets.map((item, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
              <span className="text-sm text-muted-foreground">{item}</span>
            </div>
          ))}
        </div>
      </FadeUp>

      <FadeUp delay={480}>
        <div className="bg-muted/60 border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">{s.comingTitle}</span>{" "}
            {s.comingNote}
          </p>
        </div>
      </FadeUp>
    </SlideWrap>
  );
}

/* ══════════════════════════════════════ SLIDE 7 ══════════════════════════════════════ */
const BENEFIT_ICONS = [RefreshCw, Smartphone, Globe];

function Slide7({ lang }: { lang: Lang }) {
  const s = T[lang].s7;
  return (
    <SlideWrap>
      <SlideIcon icon={Smartphone} />

      <FadeUp delay={100} className="text-center">
        <h2 className="font-display font-bold text-3xl text-foreground leading-tight">{s.title}</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {s.subtitleBefore}
          <Highlight delay={450}>{s.subtitleHighlight}</Highlight>
          {s.subtitleAfter}
        </p>
      </FadeUp>

      <FadeUp delay={260}>
        <div className="space-y-3">
          {s.benefits.map(({ title, desc }, i) => {
            const Icon = BENEFIT_ICONS[i];
            return (
              <div
                key={i}
                className="flex gap-4 items-start bg-white dark:bg-card rounded-xl border border-border/50 p-4"
                style={{ animation: `fade-up 0.4s ease-out ${340 + i * 100}ms both` }}
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-primary to-accent flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </FadeUp>

      <FadeUp delay={660}>
        <p className="text-center text-xs text-muted-foreground italic">{s.footer}</p>
      </FadeUp>
    </SlideWrap>
  );
}

/* ══════════════════════════════════════ SLIDE 8 ══════════════════════════════════════ */
function Slide8({ lang, installOS, setInstallOS, isPWA, isChromeIOS, isInApp, copyInstallLink, onDone, onInstall }: {
  lang: Lang;
  installOS: "ios" | "android" | null;
  setInstallOS: (v: "ios" | "android") => void;
  isPWA: boolean;
  isChromeIOS: boolean;
  isInApp: boolean;
  copyInstallLink: () => void;
  onDone?: () => void;
  onInstall?: () => void;
}) {
  const s = T[lang].s8;
  const s9 = T[lang].s9;
  const steps = installOS === "ios" ? s.iosSteps : installOS === "android" ? s.androidSteps : [];

  return (
    <SlideWrap>
      <FadeUp delay={0} className="text-center">
        <h2 className="font-display font-bold text-3xl text-foreground">{s.title}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{s.subtitle}</p>
      </FadeUp>

      {isPWA && (
        <FadeUp delay={80}>
          <div className="flex items-start gap-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <p className="text-sm text-green-800 dark:text-green-200">
              <strong>{s.alreadyTitle}</strong> {s.alreadyNote}
            </p>
          </div>
        </FadeUp>
      )}

      {!isPWA && (isChromeIOS || isInApp) && (
        <FadeUp delay={80}>
          <div className="bg-muted/60 border border-border rounded-xl p-4">
            <p className="text-sm text-foreground font-semibold mb-2">{s.inAppTitle}</p>
            <p className="text-xs text-muted-foreground mb-3">{s.inAppNote}</p>
            <button
              onClick={copyInstallLink}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
              data-testid="button-intro-copy-link"
            >
              {s.copyLink}
            </button>
          </div>
        </FadeUp>
      )}

      <FadeUp delay={140}>
        <div className="flex gap-2 bg-muted rounded-xl p-1">
          {(["ios", "android"] as const).map((os) => (
            <button
              key={os}
              onClick={() => setInstallOS(os)}
              data-testid={`button-intro-os-${os}`}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                installOS === os ? "bg-white dark:bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {os === "ios" ? <><SiApple className="w-4 h-4" /> {s.iosLabel}</> : <><SiAndroid className="w-4 h-4" /> {s.androidLabel}</>}
            </button>
          ))}
        </div>
      </FadeUp>

      {installOS !== null ? (
        <FadeUp delay={220}>
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-primary to-accent text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm text-foreground leading-relaxed">{step.text}</p>
                  {step.note && (
                    <p className={`text-xs mt-0.5 ${step.warn ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                      {step.note}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </FadeUp>
      ) : (
        <FadeUp delay={220}>
          <div className="text-center py-4 text-muted-foreground text-sm">{s.selectDevice}</div>
        </FadeUp>
      )}

      {/* CTA buttons — shown when this is the final slide */}
      {(onDone || onInstall) && (
        <FadeUp delay={400}>
          <div className="flex flex-col gap-3 pt-1">
            <Button
              className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-md shadow-primary/20 font-semibold"
              onClick={onInstall}
              data-testid="button-intro-install"
            >
              <Download className="w-4 h-4 mr-2" /> {s9.btnInstall}
            </Button>
            <Link href="/app">
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl border-primary/30 text-primary hover:bg-primary/5 font-semibold"
                onClick={onDone}
                data-testid="button-intro-open-app"
              >
                {s9.btnOpen} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </FadeUp>
      )}
    </SlideWrap>
  );
}

/* ══════════════════════════════════════ SLIDE 9 ══════════════════════════════════════ */
const STEP_ICONS = [Download, UserPlus, Home];

function Slide9({ lang, onDone, onInstall }: { lang: Lang; onDone: () => void; onInstall: () => void }) {
  const s = T[lang].s9;
  return (
    <SlideWrap>
      <FadeUp delay={0} className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 mx-auto mb-3">
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>
        <h2 className="font-display font-bold text-3xl text-foreground leading-tight">{s.title}</h2>
        <p className="text-muted-foreground mt-2 text-sm">{s.subtitle}</p>
      </FadeUp>

      <div className="space-y-3">
        {s.steps.map(({ title, desc }, i) => {
          const Icon = STEP_ICONS[i];
          const accent = i === 0;
          return (
            <FadeUp key={i} delay={100 + i * 120}>
              <div className={`flex items-start gap-4 p-4 rounded-2xl border ${accent ? "bg-primary/8 border-primary/25" : "bg-white dark:bg-card border-border/50"}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent ? "bg-gradient-to-tr from-primary to-accent shadow-sm shadow-primary/20" : "bg-muted"}`}>
                  <Icon className={`w-5 h-5 ${accent ? "text-white" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1">
                  <p className={`font-semibold text-sm ${accent ? "text-primary" : "text-foreground"}`}>
                    <span className={`inline-block w-5 h-5 rounded-full text-xs font-bold text-center leading-5 mr-1.5 ${accent ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                      {i + 1}
                    </span>
                    {title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            </FadeUp>
          );
        })}
      </div>

      <FadeUp delay={480}>
        <div className="flex flex-col gap-3">
          <Button
            className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-md shadow-primary/20 font-semibold"
            onClick={onInstall}
            data-testid="button-intro-install"
          >
            <Download className="w-4 h-4 mr-2" /> {s.btnInstall}
          </Button>
          <Link href="/app">
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl border-primary/30 text-primary hover:bg-primary/5 font-semibold"
              onClick={onDone}
              data-testid="button-intro-open-app"
            >
              {s.btnOpen} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <button
            onClick={onDone}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-1"
            data-testid="button-intro-see-more"
          >
            {s.btnMore}
          </button>
        </div>
      </FadeUp>
    </SlideWrap>
  );
}

/* ══════════════════════════════════════ MAIN ══════════════════════════════════════ */
const TOTAL_SLIDES = 6;

const SLIDE_NAMES = [
  "welcome",
  "household_snapshot",
  "features",
  "sage_intro",
  "practical_info",
  "install_guide",
];

interface Props {
  onDone: (scrollTo?: "install") => void;
}

export function LandingIntroSlides({ onDone }: Props) {
  const [slide, setSlide] = useState(0);
  const [dir, setDir] = useState<"next" | "prev">("next");
  const { isIOS, isAndroid, isChromeIOS, isInApp, isNativeSafari, isPWA } = useDeviceState();
  const [installOS, setInstallOS] = useState<"ios" | "android" | null>(null);
  const touchStartX = useRef<number | null>(null);
  const { language, setLanguage } = useLanguage();
  const lang = (["en", "fr", "nl"].includes(language) ? language : "en") as Lang;

  useEffect(() => {
    if (isIOS) setInstallOS("ios");
    else if (isAndroid) setInstallOS("android");
  }, [isIOS, isAndroid]);

  useEffect(() => {
    const platform = isIOS ? "ios" : isAndroid ? "android" : "desktop";
    captureEvent("intro_slides_started", { lang, is_pwa: isPWA, platform });
    captureEvent("intro_slide_viewed", { slide_number: 1, slide_name: SLIDE_NAMES[0], lang });
  }, []);

  const go = (newSlide: number, direction: "next" | "prev") => {
    setDir(direction);
    setSlide(newSlide);
    captureEvent("intro_slide_viewed", {
      slide_number: newSlide + 1,
      slide_name: SLIDE_NAMES[newSlide],
      lang,
      direction,
    });
  };

  const next = () => {
    if (slide < TOTAL_SLIDES - 1) go(slide + 1, "next");
    else done();
  };

  const prev = () => {
    if (slide > 0) go(slide - 1, "prev");
  };

  const done = (scrollTo?: "install") => {
    const isCompleted = slide === TOTAL_SLIDES - 1;
    if (isCompleted) {
      captureEvent("intro_slides_completed", {
        lang,
        exit_action: scrollTo === "install" ? "install" : "open_app",
      });
    } else {
      captureEvent("intro_slides_skipped", {
        lang,
        skipped_at_slide: slide + 1,
        skipped_at_name: SLIDE_NAMES[slide],
      });
    }
    localStorage.setItem("sl_seen_intro", "1");
    onDone(scrollTo);
  };

  const copyInstallLink = () => {
    navigator.clipboard.writeText("https://sharedledger.app").catch(() => {});
  };

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) { if (dx < 0) next(); else prev(); }
    touchStartX.current = null;
  };

  const navT = T[lang].nav;
  const animClass = dir === "next" ? "animate-slide-from-right" : "animate-slide-from-left";

  return (
    <div
      className="min-h-screen flex flex-col bg-background relative"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Top progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-muted/60">
        <div
          className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 ease-out"
          style={{ width: `${((slide + 1) / TOTAL_SLIDES) * 100}%` }}
        />
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between px-5 pt-7 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 bg-gradient-to-tr from-primary to-accent rounded-lg flex items-center justify-center"
            style={{ transform: "rotate(-6deg)" }}
          >
            <Users className="w-3.5 h-3.5 text-white" style={{ transform: "rotate(6deg)" }} />
          </div>
          <span className="font-display font-bold text-primary">SharedLedger</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Language switcher */}
          <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
            {(["en", "fr", "nl"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                className={`px-2 py-1 rounded-md text-xs font-semibold transition-all duration-150 ${
                  lang === l ? "bg-white dark:bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`button-intro-lang-${l}`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={() => done()}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 px-2.5 py-1.5 rounded-full hover:bg-muted"
            data-testid="button-intro-skip"
          >
            {navT.skip} <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Slide content */}
      <div
        key={`${slide}-${lang}`}
        className={`flex-1 flex flex-col justify-center px-5 py-2 overflow-y-auto ${animClass}`}
      >
        {slide === 0 && <Slide1 lang={lang} />}
        {slide === 1 && <Slide2 lang={lang} />}
        {slide === 2 && <Slide4 lang={lang} />}
        {slide === 3 && <Slide5 lang={lang} />}
        {slide === 4 && <SlidePractical lang={lang} />}
        {slide === 5 && (
          <Slide8
            lang={lang}
            installOS={installOS}
            setInstallOS={setInstallOS}
            isPWA={isPWA}
            isChromeIOS={isChromeIOS}
            isInApp={isInApp}
            copyInstallLink={copyInstallLink}
            onDone={() => done()}
            onInstall={() => done("install")}
          />
        )}
      </div>

      {/* Bottom navigation */}
      <div className="px-5 pb-8 pt-2 shrink-0">
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-5">
          {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
            <button
              key={i}
              onClick={() => go(i, i > slide ? "next" : "prev")}
              className={`rounded-full transition-all duration-300 ${
                i === slide ? "w-6 h-2 bg-primary" : i < slide ? "w-2 h-2 bg-primary/40" : "w-2 h-2 bg-muted-foreground/25"
              }`}
              data-testid={`dot-slide-${i}`}
            />
          ))}
        </div>

        {/* Back / Next */}
        {slide < TOTAL_SLIDES - 1 && (
          <div className="flex gap-3">
            {slide > 0 ? (
              <Button
                variant="outline"
                className="h-12 px-5 rounded-xl border-border/60"
                onClick={prev}
                data-testid="button-intro-prev"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            ) : (
              <div />
            )}
            <Button
              className="flex-1 h-12 rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-md shadow-primary/20 font-semibold"
              onClick={next}
              data-testid="button-intro-next"
            >
              {navT.next}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
