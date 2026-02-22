# Precision Interval Timer

A professional-grade, hardware-inspired interval timer and alarm clock built with React, Tailwind CSS, and Web Audio API.

![App Screenshot](https://picsum.photos/id/175/800/400)

## 🚀 Features

- **Hardware Aesthetic**: Matrix-green LCD display with a dark, professional theme.
- **🗣️ Intelligent Voice Alerts**: Natural language announcements for cycle marks (e.g., "1 minute 30 seconds left") and custom labels using Web Speech API.
- **🔊 Global Volume Control**: Persistent volume slider in the header to regulate all beeps and speech alerts.
- **🔄 Background Reliability**: Advanced "Catch-Up" logic that processes missed seconds if the browser throttles the tab, ensuring alarms never fail.
- **🎶 Expanded Sound Profiles**: High-quality presets including Chime, Buzzer, Sonar, Classic Square, and Alarm.
- **💾 Persistence**: Automatically saves your rules and volume settings to local storage.
- **🚀 Automated Deployment**: Integrated GitHub Actions for seamless deployment to GitHub Pages.
- **📱 Responsive & Installable**: Works on all devices and supports PWA installation.

## 🛠️ Tech Stack

- **Framework**: React 19
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React
- **Animations**: Motion
- **Time Formatting**: date-fns
- **Audio**: Web Audio API

## 💻 Local Development

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd precision-interval-timer
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

## 🌐 Deployment

This project is ready to be deployed to any static hosting service (Vercel, Netlify, GitHub Pages, etc.).

### Deploying to GitHub Pages

1. Create a new repository on GitHub.
2. Push your code to the repository.
3. Go to **Settings > Pages** and select the branch you want to deploy from.

## 📄 License

SPDX-License-Identifier: Apache-2.0
