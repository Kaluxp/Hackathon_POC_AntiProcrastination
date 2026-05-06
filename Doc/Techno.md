# 🧱 Base
**Langage** : TypeScript
**API** : VS Code Extension API
**Outil** : yo code (generator officiel)

# 📦 Structure simple
top-chrono/<br>
 ├── src/<br>
 │   ├── extension.ts<br>
 │   ├── timer.ts<br>
 │   ├── activity.ts<br>
 │   ├── rank.ts<br>
 │   └── ui.ts<br>
 ├── package.json<br>

# ⚙️ Features à coder
## 1. Timer
    setInterval toutes les 1s
    stocke :
    temps travail
    temps pause accumulé

## 2. Détection d’activité

Avec l’API VS Code :

onDidChangeTextDocument → écriture
onDidChangeActiveTextEditor → navigation
onDidSaveTextDocument → action utile

👉 incrémente activité

## 3. UI (très important)
window.createStatusBarItem()

Affichage :

**⏳ 12:32 | ☕ 02:10 | 🔥 Guerrier**

## 4. Système de pause

*Simple pour hackathon :*

commande : Start Break <br>
désactive interactions (ou message plein écran)<br>
timer pause<br>

## 5. Ranks

Simple JSON

```typescript
[
  { name: "Petit soldat", time: 600 },
  { name: "Guerrier", time: 3600 },
  { name: "Stratège", time: 10800 },
  { name: "Maître Sith", time: 18000 }
]
```

## 6. Notifications

```typescript
vscode.window.showInformationMessage("Pause terminée !");
```

## Bonus
stockage local (globalState)<br>
badge export markdown<br>
son / animation<br>