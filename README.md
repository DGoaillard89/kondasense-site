# Konda Sence Website

Welcome to the Konda Sence website, a remote temperature monitoring company focused on legionella control. This project showcases our commitment to providing effective solutions for temperature monitoring to ensure safety and compliance.

## Project Structure

- **docs/**: Contains all source files (published by GitHub Pages) for the website.
  - **index.html**: The main HTML file for the front page.
  - **styles/**: Contains CSS files for styling the website.
    - **style.css**: The main stylesheet for the website.
  - **scripts/**: Contains JavaScript files for interactivity.
    - **main.js**: The main JavaScript file for the website.
  - **assets/**: Contains images and other assets used in the website.
    - **images/**: Folder for storing images.

## Page sections

- **Hero**: an animated building cross-section. Konda Nodes on the CWST, calorifier and outlets send simulated live readings to the Konda Hub, then to the cloud and the Konda app. Every ~20 seconds a demo alert fires when the floor 3 hot outlet drops below 50°C.
- **How it works**: four steps, from fitting sensors to automatic alerts and logbook.
- **Why legionella**: the 20–45°C growth zone, plus the HSG274 temperature targets.
- **Hardware**: the Konda Hub and Konda Node render.
- **Features & industries**
- **Book a demo**: front-end-only form. It validates input and shows a thank-you message, but sends nothing.

## Brand

- Colours are defined as CSS variables at the top of `docs/styles/style.css`. Teal `#239FA0` is the official logo colour; purple `#4B2A99` / `#22114F` is sampled from the hardware render.
- Font: Poppins (Google Fonts).
- Logo: the official teal lockup is `docs/assets/images/konda-logo.png`. The favicon `konda-mark.svg` is the K mark redrawn as a vector from that file.

## Getting Started

To run this project locally, clone the repository and open the `index.html` file in your web browser. No backend functionality is included, as this is a front-end showcase.

## License

This project is licensed under the MIT License.