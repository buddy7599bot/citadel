# Task: Interactive Animated Jedi Process Stepper

Build a standalone HTML page at `/home/ubuntu/clawd/projects/jedi-stepper/index.html` that shows an interactive, animated process stepper/pipeline visualizing the 6 Alliance "Jedis" (AI agents) and how they work together.

## The 6 Jedis

1. **Buddy** (🤝) - The Coordinator/Supervisor - Delegates tasks, checks inbox, monitors all agents, alerts Jay. Color: blue (#3B82F6)
2. **Katy** (💅) - X/Growth Strategist - Finds viral posts, drafts comments in Jay's voice, tracks engagement, posts to X. Color: pink (#EC4899)  
3. **Elon** (🚀) - Builder Bot - Builds MVPs overnight, deploys to Vercel, ideates products, ships fast. Color: orange (#F97316)
4. **Burry** (📉) - Trading Analyst - Monitors crypto bots, tracks PnL, analyzes markets, manages positions. Color: green (#10B981)
5. **Jerry** (💼) - Job Scout - Finds PM roles, scouts LinkedIn/AngelList/YC, matches to Jay's profile. Color: purple (#8B5CF6)
6. **Mike** (🛡️) - Security Guard - SSH monitoring, fail2ban, port scanning, VPN watchdog, infra health. Color: red (#EF4444)

## Design Requirements

- Dark theme (bg #0a0a0a or similar)
- Each agent is a "node" in the pipeline
- Buddy is at the CENTER (hub-and-spoke model) - all agents connect through Buddy
- Animated connections between agents showing data flow (glowing lines, particles, pulses)
- Click on any agent to see their details panel slide in (role, tools, schedule, current status)
- Animated step-through mode: a "Play" button that walks through a typical day:
  1. Jay creates a task in Citadel
  2. Buddy picks it up from inbox
  3. Buddy delegates to the right agent via @mention
  4. Agent does the work (show tools being used)
  5. Agent posts results back
  6. Buddy compiles and reports to Jay
- Each step has smooth transitions and animations
- Use CSS animations and vanilla JS only (no frameworks needed for a single page)
- Responsive - works on mobile too
- Add a particle/starfield background for the "space" Jedi theme
- Agent nodes should have a subtle glow/pulse animation
- Connection lines should have flowing particle effects
- Include a "lightsaber" accent - maybe glowing edges or slash animations on transitions

## Technical
- Single HTML file with inline CSS and JS
- No external dependencies except maybe a font (Inter or similar from Google Fonts)
- Canvas for particle effects, HTML/CSS for the UI layer
- Make it BEAUTIFUL - this is a showpiece

## Output
- Save to /home/ubuntu/clawd/projects/jedi-stepper/index.html
- Must be viewable by opening the file directly in a browser
