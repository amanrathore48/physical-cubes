# Physical Cubes

An interactive 3D physics simulation with draggable cubes built with:

- [Next.js](https://nextjs.org) - React framework
- [Three.js](https://threejs.org/) - 3D graphics library
- [Cannon.js](https://schteppe.github.io/cannon.js/) - 3D physics engine
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## How to Use

1. When the application loads, you'll see colorful cubes falling and bouncing on a floor
2. Click and drag any cube to move it around in 3D space
3. Release the cube to let it fall naturally with physics
4. Try throwing cubes at each other to see realistic collisions
5. Experiment with different dragging speeds to see momentum in action

## Features

- Interactive 3D physics simulation with realistic physics
- Click and drag cubes to move them through 3D space
- Physics-based interactions using Cannon.js constraints
- Realistic collisions, gravity, and momentum
- Fully responsive design that works on different screen sizes

## Project Structure

- `src/components/ThreeScene.js` - The main Three.js scene component with physics integration
- `src/components/ThreeSceneWrapper.js` - Client-side wrapper for the 3D scene
- `src/utils/threeHelpers.js` - Helper functions for Three.js and Cannon.js
- `src/app/page.js` - Main page with Three.js scene integration
- `src/app/layout.js` - Root layout with metadata and global styles
- `explanation.md` - Detailed explanation of the physics implementation

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!
