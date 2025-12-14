/**
 * Cosmic Tic-Tac-Toe - Particle System
 * Handles all spectacular visual effects
 */

class Particle {
    constructor(x, y, options = {}) {
        this.x = x;
        this.y = y;
        this.vx = options.vx || (Math.random() - 0.5) * 4;
        this.vy = options.vy || (Math.random() - 0.5) * 4;
        this.size = options.size || Math.random() * 3 + 1;
        this.color = options.color || '#ffffff';
        this.alpha = options.alpha || 1;
        this.decay = options.decay || 0.02;
        this.gravity = options.gravity || 0;
        this.friction = options.friction || 0.99;
        this.life = options.life || 1;
        this.maxLife = this.life;
        this.type = options.type || 'circle';
        this.rotation = options.rotation || 0;
        this.rotationSpeed = options.rotationSpeed || 0;
        this.trail = options.trail || false;
        this.trailLength = options.trailLength || 5;
        this.history = [];
    }

    update() {
        if (this.trail) {
            this.history.push({ x: this.x, y: this.y, alpha: this.alpha });
            if (this.history.length > this.trailLength) {
                this.history.shift();
            }
        }

        this.vx *= this.friction;
        this.vy *= this.friction;
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        this.alpha = Math.max(0, this.life / this.maxLife);
        this.rotation += this.rotationSpeed;

        return this.life > 0;
    }

    draw(ctx) {
        ctx.save();

        // Draw trail
        if (this.trail && this.history.length > 0) {
            for (let i = 0; i < this.history.length; i++) {
                const point = this.history[i];
                const trailAlpha = (i / this.history.length) * this.alpha * 0.5;
                ctx.globalAlpha = trailAlpha;
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(point.x, point.y, this.size * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.globalAlpha = this.alpha;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        if (this.type === 'circle') {
            // Glowing circle
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size * 2);
            gradient.addColorStop(0, this.color);
            gradient.addColorStop(0.5, this.color + '80');
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'star') {
            // Star shape
            ctx.fillStyle = this.color;
            this.drawStar(ctx, 0, 0, 5, this.size, this.size * 0.5);
        } else if (this.type === 'spark') {
            // Spark/line
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.size * 0.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-this.size, 0);
            ctx.lineTo(this.size, 0);
            ctx.stroke();
        } else if (this.type === 'ring') {
            // Ring
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }

    drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fill();
    }
}

class ParticleSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.backgroundStars = [];
        this.initBackgroundStars();
    }

    initBackgroundStars() {
        // Create static background stars
        for (let i = 0; i < 200; i++) {
            this.backgroundStars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 2 + 0.5,
                twinkle: Math.random() * Math.PI * 2,
                twinkleSpeed: Math.random() * 0.02 + 0.01
            });
        }
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.initBackgroundStars();
    }

    // Spectacular symbol placement effect
    symbolPlacement(x, y, symbol) {
        const isOrbis = symbol === 'O';
        const color = isOrbis ? '#00d4ff' : '#ff3366';
        const secondaryColor = isOrbis ? '#0080ff' : '#ff6600';

        // Central burst
        for (let i = 0; i < 30; i++) {
            const angle = (Math.PI * 2 / 30) * i;
            const speed = Math.random() * 8 + 4;
            this.particles.push(new Particle(x, y, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 4 + 2,
                color: color,
                decay: 0.03,
                type: 'circle',
                trail: true,
                trailLength: 8
            }));
        }

        // Ring expansion
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                for (let j = 0; j < 20; j++) {
                    const angle = (Math.PI * 2 / 20) * j;
                    const radius = 20 + i * 15;
                    this.particles.push(new Particle(
                        x + Math.cos(angle) * radius,
                        y + Math.sin(angle) * radius,
                        {
                            vx: Math.cos(angle) * 2,
                            vy: Math.sin(angle) * 2,
                            size: 3,
                            color: secondaryColor,
                            decay: 0.04,
                            type: 'ring',
                            life: 0.8
                        }
                    ));
                }
            }, i * 100);
        }

        // Sparkle effect
        for (let i = 0; i < 15; i++) {
            this.particles.push(new Particle(x, y, {
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                size: Math.random() * 5 + 2,
                color: '#ffffff',
                decay: 0.05,
                type: 'star',
                rotationSpeed: Math.random() * 0.2 - 0.1
            }));
        }
    }

    // Victory line cascade effect
    victoryCascade(cells, symbol) {
        const isOrbis = symbol === 'O';
        const color = isOrbis ? '#00d4ff' : '#ff3366';
        const secondaryColor = isOrbis ? '#0080ff' : '#ff6600';
        const goldColor = '#ffd700';

        // Energy beam along winning line
        for (let i = 0; i < cells.length - 1; i++) {
            const start = cells[i];
            const end = cells[i + 1];
            this.createBeam(start.x, start.y, end.x, end.y, color);
        }

        // Massive central explosion
        const centerX = (cells[0].x + cells[2].x) / 2;
        const centerY = (cells[0].y + cells[2].y) / 2;

        setTimeout(() => {
            // Victory explosion
            for (let i = 0; i < 100; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 15 + 5;
                this.particles.push(new Particle(centerX, centerY, {
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: Math.random() * 6 + 3,
                    color: Math.random() > 0.3 ? color : goldColor,
                    decay: 0.015,
                    type: Math.random() > 0.5 ? 'circle' : 'star',
                    trail: true,
                    trailLength: 10,
                    friction: 0.98
                }));
            }

            // Screen-wide sparkles
            for (let i = 0; i < 50; i++) {
                this.particles.push(new Particle(
                    Math.random() * this.canvas.width,
                    Math.random() * this.canvas.height,
                    {
                        vx: 0,
                        vy: Math.random() * -2 - 1,
                        size: Math.random() * 4 + 2,
                        color: secondaryColor,
                        decay: 0.01,
                        type: 'star',
                        rotationSpeed: 0.1
                    }
                ));
            }
        }, 300);

        // Pulsing rings from each winning cell
        cells.forEach((cell, index) => {
            setTimeout(() => {
                for (let r = 0; r < 5; r++) {
                    setTimeout(() => {
                        for (let j = 0; j < 16; j++) {
                            const angle = (Math.PI * 2 / 16) * j;
                            this.particles.push(new Particle(cell.x, cell.y, {
                                vx: Math.cos(angle) * (3 + r),
                                vy: Math.sin(angle) * (3 + r),
                                size: 4,
                                color: color,
                                decay: 0.03,
                                type: 'circle'
                            }));
                        }
                    }, r * 50);
                }
            }, index * 150);
        });
    }

    // Draw energy beam
    createBeam(x1, y1, x2, y2, color) {
        const steps = 20;
        const dx = (x2 - x1) / steps;
        const dy = (y2 - y1) / steps;

        for (let i = 0; i <= steps; i++) {
            setTimeout(() => {
                const x = x1 + dx * i;
                const y = y1 + dy * i;

                // Beam particles
                for (let j = 0; j < 5; j++) {
                    this.particles.push(new Particle(x, y, {
                        vx: (Math.random() - 0.5) * 3,
                        vy: (Math.random() - 0.5) * 3,
                        size: Math.random() * 4 + 2,
                        color: color,
                        decay: 0.04,
                        type: 'circle',
                        trail: true,
                        trailLength: 5
                    }));
                }
            }, i * 20);
        }
    }

    // Draw stalemate storm (dual-force explosion)
    stalemateTempest(centerX, centerY) {
        const orbisColor = '#00d4ff';
        const cruciaColor = '#ff3366';

        // Dual spiral explosion
        for (let i = 0; i < 60; i++) {
            const angle = (Math.PI * 2 / 30) * i;
            const speed = Math.random() * 10 + 5;
            const color = i % 2 === 0 ? orbisColor : cruciaColor;

            this.particles.push(new Particle(centerX, centerY, {
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 5 + 2,
                color: color,
                decay: 0.02,
                type: 'circle',
                trail: true,
                trailLength: 8
            }));
        }

        // Balanced energy waves
        for (let r = 0; r < 4; r++) {
            setTimeout(() => {
                for (let j = 0; j < 24; j++) {
                    const angle = (Math.PI * 2 / 24) * j;
                    const color = j % 2 === 0 ? orbisColor : cruciaColor;
                    this.particles.push(new Particle(centerX, centerY, {
                        vx: Math.cos(angle) * (5 + r * 2),
                        vy: Math.sin(angle) * (5 + r * 2),
                        size: 5,
                        color: color,
                        decay: 0.025,
                        type: 'ring',
                        life: 1.2
                    }));
                }
            }, r * 100);
        }

        // Universe birth sparkles
        setTimeout(() => {
            for (let i = 0; i < 80; i++) {
                this.particles.push(new Particle(
                    Math.random() * this.canvas.width,
                    Math.random() * this.canvas.height,
                    {
                        vx: 0,
                        vy: 0,
                        size: Math.random() * 4 + 1,
                        color: '#ffffff',
                        decay: 0.01,
                        type: 'star',
                        rotationSpeed: Math.random() * 0.1
                    }
                ));
            }
        }, 500);
    }

    // Defeat effect
    defeatEffect(centerX, centerY) {
        const cruciaColor = '#ff3366';

        // Dark collapse
        for (let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 100 + 50;
            const startX = centerX + Math.cos(angle) * distance;
            const startY = centerY + Math.sin(angle) * distance;

            this.particles.push(new Particle(startX, startY, {
                vx: -Math.cos(angle) * 3,
                vy: -Math.sin(angle) * 3,
                size: Math.random() * 4 + 2,
                color: cruciaColor,
                decay: 0.03,
                type: 'circle',
                trail: true,
                trailLength: 6
            }));
        }
    }

    // Cell hover effect
    cellHover(x, y, symbol) {
        const color = symbol === 'O' ? '#00d4ff' : '#ff3366';

        for (let i = 0; i < 3; i++) {
            this.particles.push(new Particle(x, y, {
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                size: Math.random() * 2 + 1,
                color: color,
                decay: 0.05,
                type: 'circle'
            }));
        }
    }

    update() {
        // Update background stars
        this.backgroundStars.forEach(star => {
            star.twinkle += star.twinkleSpeed;
        });

        // Update particles
        this.particles = this.particles.filter(p => p.update());
    }

    draw() {
        // Clear
        this.ctx.fillStyle = '#0a0a0f';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw nebula background
        this.drawNebula();

        // Draw background stars
        this.backgroundStars.forEach(star => {
            const brightness = 0.3 + Math.sin(star.twinkle) * 0.7;
            this.ctx.globalAlpha = brightness;
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;

        // Draw particles
        this.particles.forEach(p => p.draw(this.ctx));
    }

    drawNebula() {
        // Create subtle nebula gradients
        const time = Date.now() * 0.0001;

        // Blue nebula
        const grad1 = this.ctx.createRadialGradient(
            this.canvas.width * 0.2 + Math.sin(time) * 50,
            this.canvas.height * 0.3,
            0,
            this.canvas.width * 0.2,
            this.canvas.height * 0.3,
            300
        );
        grad1.addColorStop(0, 'rgba(0, 80, 160, 0.1)');
        grad1.addColorStop(1, 'transparent');
        this.ctx.fillStyle = grad1;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Purple nebula
        const grad2 = this.ctx.createRadialGradient(
            this.canvas.width * 0.8 + Math.cos(time) * 50,
            this.canvas.height * 0.7,
            0,
            this.canvas.width * 0.8,
            this.canvas.height * 0.7,
            250
        );
        grad2.addColorStop(0, 'rgba(100, 0, 100, 0.1)');
        grad2.addColorStop(1, 'transparent');
        this.ctx.fillStyle = grad2;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    clear() {
        this.particles = [];
    }
}

// Export for use in other modules
window.ParticleSystem = ParticleSystem;
