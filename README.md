# Lunar Days Out

A browser-playable lunar outpost game prototype. Explore the base, collect samples, manage power and suit supplies, and respond to a historical solar-particle-event timeline.

## Requirements

- Node.js 18 or newer and npm
- A free NASA API key for the DONKI solar-event display
- A modern desktop browser

## Set up and run

1. Clone the repository and enter its folder:

   ```bash
   git clone https://github.com/knigamm/LunarDaysOut.git
   cd LunarDaysOut
   ```

2. Install the project dependencies:

   ```bash
   npm install
   ```

3. Get a NASA API key at [api.nasa.gov](https://api.nasa.gov/). In the project folder, create a file named `.env.local` containing:

   ```dotenv
   NASA_API_KEY=put_your_key_here
   ```

   You can start from `.env.example` by copying it to `.env.local`, then replace the example value with your key. Keep `.env.local` private; it is ignored by Git and must not be committed.

4. Start the local game:

   ```bash
   npm run dev
   ```

5. Open the local address printed in the terminal, usually <http://localhost:5173>.

If you add or change the API key while the server is running, stop it with `Ctrl+C` and run `npm run dev` again. The game can open without a key, but the NASA event display will report that the data is offline.

## Controls

- **WASD** or **arrow keys** — move
- **E** — interact with nearby buildings and sample sites; open or close the control-room computer; enter or leave the shelter
- **F** — put on or store the suit while inside the control room
- **C** — eat a meal indoors to restore stamina
- **G** — switch the greenhouse on or off
- **Esc** — leave the control room or shelter

Collect three samples, carry them one at a time to the research lab, and complete the research before the mission deadline. The control-room computer lets you check the solar-event timeline and spend base power to reinforce the shelter. Reinforcement pauses greenhouse production while it is built.

## NASA data and the simulation

The game requests archived Solar Energetic Particle (SEP) records from NASA's [DONKI SEP endpoint](https://api.nasa.gov/DONKI/SEP) for **January 23–31, 2012**. The event timestamps and instrument names come from DONKI and are replayed against the in-game clock (one game hour takes five real seconds).

DONKI's event records are not radiation-dose readings for the Moon or for this outpost. The game groups nearby records into playable episodes; its warning lead time, event duration, exposure meter, and consequences are simulation rules for teaching trade-offs. They are not NASA forecasts or measured lunar radiation levels.

The development server forwards requests through a local Vite server route so the NASA key stays out of browser code. This prototype is set up for local development. A static-only host such as GitHub Pages cannot run that server route; online deployment will need a server-side proxy that keeps the API key secret.

## Project

- Source code: [GitHub repository](https://github.com/knigamm/LunarDaysOut)
- Stack: HTML, CSS, JavaScript, and Vite
- NASA data: [NASA DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/)
