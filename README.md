# AutoCraft - Path of Exile 2

**Visual automation assistant for crafting in Path of Exile 2**

Create automation pipelines without writing code, use our intuitive visual editor, and share your strategies with the community!

---

## What is AutoCraft?

AutoCraft is an automation bot for PoE2 that puts **you in control** with a user-friendly visual interface. Instead of dealing with complex configuration files, you **design your workflow visually** and AutoCraft executes it.

### Common Use Cases
- **Chaos Spam**: Automate multiple chaos orb attempts
- **Multicraft**: Apply multiple currencies in sequence
- **Modifier Verification**: Search for specific modifiers automatically
- **Smart Loops**: Repeat actions until you get the desired result

---

## What Makes AutoCraft Special?

### Visual Flow Editor
No code needed here. You drag, connect, and click. It's like building a workflow:

```
┌─────────────┐
│ Start       │
└──────┬──────┘
       │
  ┌────▼──────────────────┐
  │ Right Click           │
  │ Select Chaos          │
  └────┬──────────────────┘
       │
  ┌────▼──────────────────┐
  │ Left Click            │
  │ Apply to Item         │
  └────┬──────────────────┘
       │
  ┌────▼──────────────────┐
  │ Check Region          │
  │ Check Tooltip         │
  └────┬──────┬───────────┘
  YES  │       │ NO
       │       │
    END      (back to start)
```

### Search for Exactly What You Want
- Configure modifiers with value ranges
- Search for multiple mods at the same time
- Smart matching system that avoids false positives
- Optimized OCR for reading tooltips with precision

### Share Your Strategies
- Export your flows as JSON
- Import ready-made flows from friends or community
- Reconfigure for your PC in seconds
- Build your personal library of automations

### Simple Controls
- F6 to stop at any time
- Real-time logs to track everything
- Responsive interface that works well
- Supports automatic Shift for fast actions

---

## Quick Installation

### Prerequisites
- Node.js 16+ installed
- Windows (primary support)
- Path of Exile 2 open in windowed mode

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/estopassoli/autocraft.git
cd autocraft

# 2. Install dependencies
npm install

# 3. Compile the visual editor
npm run build:flow

# 4. Start!
npm start
```

---

## Available Node Types

### Left Click (leftClick)
Clicks with the left mouse button at a position
- Position capture via interface
- Option to hold Shift
- Configurable delay after click

### Right Click (rightClick)
Clicks with the right mouse button (select currency, etc)
- Position capture via interface
- Configurable delay after click

### Check Region (checkRegion)
Captures a screen region and checks for modifiers via OCR
- YES output (green): Modifier found
- NO output (red): Modifier not found
- Region capture via interface
- Compares with configured modifier list

### Delay
Waits a specific time before continuing
- Time configurable in milliseconds
- Useful for waiting for tooltips to appear

---

## Getting Started

### 1. Open the Interface

```bash
npm start
```

You'll see the main AutoCraft window with 2 tabs.

### 2. Go to the "Advanced" Tab

This is where the magic happens. You will:
- See the visual flow editor
- Add nodes (actions)
- Connect them together

### 3. Build Your First Flow

Example: Chaos Spam

1. Click "Add Node" with type "Right Click"
2. Click the edit button to configure
3. Set a nice name like "Select Chaos"
4. Click "Capture Position" and click the currency in your game
5. Repeat for the next steps:
   - Left Click: "Apply to Item"
   - Check Region: "Check Tooltip" (mark Shift here)
6. Connect nodes by dragging from the bottom circle to the top of the next node

### 4. Configure the Mods You're Looking For

In the "Simple" tab, write the modifiers:

```
#% increased Spell Damage (min: 50)
+# to maximum Life (min: 60)
```

### 5. Execute

- Click "Start Craft"
- Minimize the window
- AutoCraft will do its magic
- Press F6 to stop

---

## Export and Import Flows

### To Share Your Flow

1. Finish configuring your flow
2. Click "Export"
3. Choose a descriptive name like `chaos-helmet-res-life.json`
4. Save it somewhere
5. Share on Discord or the community!

### To Use Someone Else's Flow

1. Receive the `.json` file
2. Click "Import" in the Advanced tab
3. Select the file
4. Important: The flow will load, but positions are from the creator's PC!
5. Edit each node and recapture positions by clicking "Capture Position"
6. Configure the mods in the Simple tab
7. Test with a cheap item first!

---

## Changelog

### v1.0.2 (Current)
**Released**: February 2026

**What Improved**:
- Crafting History Now Inverted: Recent mods now appear at the top (DESC order)
- Fixed sorting to show correct chronology
- Better organized history interface

**How to Use**:
- The history is displayed next to the main tab
- See the last mods found in the order they were discovered

### Roadmap

**v1.0.3** (in planning)
- OCR speed improvements
- More visual range configuration interface
- History saved to file (backup)

**v1.1.0** (in discussion)
- Multi-monitor support
- User-customizable shortcuts
- Shared flow library for the community

---

## Node Types Explained

### Left Click
Simple: clicks with the left button where you tell it to.
- Use for: clicking buttons, applying items, etc
- Capture: you indicate where to click
- Option: mark Shift if you want to click while holding Shift
- Delay: how many milliseconds to wait after

### Right Click
Clicks with the right button (context menu).
- Use for: selecting currency, opening menus
- Configuration: same as Left Click

### Check Region
Captures part of the screen, reads the text, and checks if the mod you want is there.
- Use for: reading tooltips and deciding what to do
- YES output (green): found the mod -> goes to that path
- NO output (red): didn't find it -> goes to another path
- Capture: you mark the tooltip area
- Connect: use to create loops (goes back to the beginning if not found)

### Delay
Just waits a certain amount of time.
- Use for: waiting for tooltip to appear, synchronizing actions
- Configuration: time in milliseconds (1000 = 1 second)

---

## Technical Configuration

### Project Structure

```
autocraft/
├── main.js                    # Electron core
├── ui/
│   ├── index.html             # Main interface
│   ├── renderer.js            # UI logic
│   ├── flow-editor.jsx        # Visual editor (React Flow)
│   └── crafting-history.html  # Crafting history
├── src/
│   ├── config.js              # Configuration
│   ├── crafter.js             # Execution engine
│   ├── mouseController.js     # Mouse control
│   ├── ocr.js                 # Text reading
│   ├── screenCapture.js       # Screen capture
│   └── calibration.js         # Calibration
├── data/
│   ├── items.json             # Items database
│   └── mods.json              # Modifiers database
└── logs/                      # Execution logs
```

---

## Available Commands

```bash
npm start              # Start the graphical interface
npm run build:flow     # Compile the visual editor
npm run build          # Full build for distribution
```

---

## Troubleshooting

### Flow won't execute
1. Did you capture ALL positions? Click the edit button on each node
2. Does the OCR region cover ALL the tooltip text? Recapture larger
3. Are the mods written in the Simple tab? Copy from the game if needed
4. Is the game in windowed mode (not fullscreen)?

### OCR not detecting modifiers
1. Increase the delay before Check Region (test 500ms)
2. Recapture the region larger (include more space around it)
3. Try recapturing when the tooltip is clearly visible
4. Check the logs to see what's being read

### Clicks in wrong places
1. The game may have moved - minimize AutoCraft before starting
2. Try with the game in windowed mode
3. Recapture positions
4. Test manually in PoE2 before running the flow

---

## Pro Tips

| Tip | What | Why |
|-----|------|-----|
| Use descriptive names | Use "Click Chaos Orb" instead of "rightClick" | Makes it easier to understand the flow later |
| Test with cheap items | Always test new flows on cheap items first | Avoids losing valuable items |
| Adjust delays | If tooltip doesn't appear, increase delay | Your PC might be slower |
| Organize flows | Create folders by craft type | Reuse them later |
| Smart Shift | Mark it only on the first click after currency | Improves speed |
| Monitor initial runs | Follow the first loops | Validates everything works |

---

## Important Warnings

### Your Responsibility
Automation may violate Path of Exile 2's Terms of Service. Use with wisdom and moderation.

### Positions Are Personal
- Each PC has different resolution
- ALWAYS recapture positions when importing flows
- Don't blindly trust downloaded flows

### RNG is RNG
- AutoCraft doesn't change probabilities
- It just automates clicks
- Patience and persistence are your best friends

---

## License

ISC - Use freely!

---

## Good Luck Crafting!

Made with love for the PoE2 community.

Questions? Open an issue on GitHub!
