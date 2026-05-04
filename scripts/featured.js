const FeaturedGames = {
    games: [
        { name: 'Fortnite', icon: 'fa-solid fa-crosshairs', url: 'pages/player.html?type=game&title=Fortnite&url=https://nowgg.fun/apps/aptoide/5874/aptoide.html?deep_link=aptoidesearch://com.epicgames.fortnite' },
        { name: 'Games', icon: 'fa-solid fa-gamepad', url: 'pages/games.html' },
        { name: 'Movies', icon: 'fa-solid fa-film', url: 'pages/movies.html' },
        { name: 'PhantomAI', icon: 'fa-solid fa-robot', url: 'pages/chat.html' },
        { name: 'Music', icon: 'fa-solid fa-music', url: 'pages/music.html' },
        { name: 'Roblox', icon: 'fa-solid fa-cubes', url: 'pages/player.html?type=game&title=Roblox&url=https://nowgg.fun/apps/aptoide/5874/aptoide.html?deep_link=aptoidesearch://roblox.com.roblox' },
        { name: 'Settings', icon: 'fa-solid fa-cog', url: 'pages/settings.html' },
        { name: 'Geometry Dash', gameName: 'Geometry Dash Lite (REMAKE)' },
        { name: 'Retro Bowl', gameName: 'Retro Bowl' },
        { name: 'OvO', gameName: 'Ovofixed', img: 'https://cdn.jsdelivr.net/gh/gn-math/covers@main/1.png', bgColor: 'var(--surface-hover)' },
        { name: 'Basket Random', gameName: 'Basket Random' },
        { name: 'Code Runner', icon: 'fa-solid fa-code', url: 'pages/code.html' }
    ],

    async load() {
        try {
            let allGames = [];
            if (window.Gloader) {
                allGames = await window.Gloader.load('multi');
            } else {
                console.warn("Gloader not found in featured.js");
                const data = await (await fetch("https://cdn.jsdelivr.net/gh/gn-math/assets@latest/zones.json")).json();
                allGames = data.map(g => ({
                    name: (g.name || g.title),
                    url: (g.url || g.file)?.replace('{HTML_URL}', "https://cdn.jsdelivr.net/gh/gn-math/html@main"),
                    img: (g.cover || g.img || g.image)?.replace('{COVER_URL}', "https://cdn.jsdelivr.net/gh/gn-math/covers@main")
                }));
            }

            const preloads = this.games.map(async g => {
                if (!g.gameName) return;

                const searchName = g.gameName.toLowerCase().replace(/[^a-z0-9]/g, '');
                const targetGame = allGames.find(game =>
                    (game.normalized && game.normalized === searchName) ||
                    game.name.toLowerCase().replace(/[^a-z0-9]/g, '') === searchName
                );

                if (targetGame && targetGame.url) {
                    g.url = `pages/player.html?type=game&title=${encodeURIComponent(g.name)}&url=${encodeURIComponent(targetGame.url)}`;
                    g.img = g.img || targetGame.img || `https://cdn.jsdelivr.net/gh/gn-math/assets@latest/images/${g.gameName.toLowerCase().replace(/\s+/g, '-')}.png`;

                    const img = new Image();
                    img.src = g.img;
                } else {
                    g.url = `pages/games.html?gamename=${encodeURIComponent(g.gameName)}`;
                    g.icon = 'fa-solid fa-gamepad';
                }
            });
            await Promise.all(preloads);
        } catch (e) {
            console.error(e);
            this.games.forEach(g => g.gameName && (g.url = `pages/games.html?gamename=${encodeURIComponent(g.gameName)}`, g.icon = 'fa-solid fa-gamepad'));
        }
    }
};

window.FeaturedGames = FeaturedGames;