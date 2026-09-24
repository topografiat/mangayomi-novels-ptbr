const mangayomiSources = [{
    "name": "BR Yaoi - Novels",
    "lang": "pt",
    "baseUrl": "https://bryaoi.com",
    "apiUrl": "",
    "iconUrl": "https://bryaoi.com/favicon.ico",
    "typeSource": "single",
    "itemType": 2,
    "version": "0.1.0",
    "pkgPath": "novel/src/pt/bryaoi.js",
    "notes": "Novels em português do BR Yaoi."
}];

class DefaultExtension extends MProvider {
    getHeaders(url) {
        return {
            "User-Agent": "Mozilla/5.0 (Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
            "Referer": this.source.baseUrl + "/"
        };
    }

    absoluteUrl(href) {
        if (!href) return "";
        if (href.startsWith("http://") || href.startsWith("https://")) return href;
        if (href.startsWith("//")) return "https:" + href;
        if (href.startsWith("/")) return this.source.baseUrl + href;
        return this.source.baseUrl + "/" + href;
    }

    async fetch(url) {
        const res = await new Client().get(url, this.getHeaders(url));
        if (res.statusCode !== 200) throw new Error("BR Yaoi retornou HTTP " + res.statusCode);
        return new Document(res.body);
    }

    imageUrl(element) {
        const img = element.selectFirst("img");
        if (!img) return "";
        return this.absoluteUrl(
            img.attr("data-src") || img.attr("data-lazy-src") ||
            img.attr("data-original") || img.attr("src") || ""
        );
    }

    async getNovelList(page) {
        const n = page || 1;
        const url = n === 1
            ? this.source.baseUrl + "/category/novel/"
            : this.source.baseUrl + "/category/novel/page/" + n + "/";
        const doc = await this.fetch(url);
        const list = [];
        const seen = {};

        const selectors = [
            "main article a", "article a", ".post a",
            ".blog-post a", ".item-summary a", ".page-item-detail a"
        ];

        for (const selector of selectors) {
            for (const a of doc.select(selector)) {
                const href = a.attr("href") || "";
                const name = (a.text || "").replace(/\s+/g, " ").trim();
                const link = this.absoluteUrl(href);
                if (!name || !link.includes("/yaoi/") || link.includes("/ler/") || seen[link]) continue;
                seen[link] = true;
                list.push({name, link, imageUrl: this.imageUrl(a)});
            }
        }

        if (list.length === 0) {
            for (const a of doc.select("a")) {
                const href = a.attr("href") || "";
                const name = (a.text || "").replace(/\s+/g, " ").trim();
                const link = this.absoluteUrl(href);
                if (!name || !link.includes("/yaoi/") || link.includes("/ler/") || seen[link]) continue;
                seen[link] = true;
                list.push({name, link, imageUrl: this.imageUrl(a)});
            }
        }

        let hasNextPage = false;
        for (const a of doc.select("a")) {
            const text = (a.text || "").replace(/\s+/g, " ").trim().toLowerCase();
            const href = a.attr("href") || "";
            if (href.includes("/category/novel/page/" + (n + 1) + "/") ||
                text === "»" || text.includes("próxima")) {
                hasNextPage = true;
                break;
            }
        }

        return {list, hasNextPage};
    }

    async getPopular(page) {
        return await this.getNovelList(page);
    }

    get supportsLatest() {
        return true;
    }

    async getLatestUpdates(page) {
        return await this.getNovelList(page);
    }

    async search(query, page, filters) {
        const doc = await this.fetch(this.source.baseUrl + "/?s=" + encodeURIComponent(query));
        const list = [];
        const seen = {};
        const wanted = (query || "").toLowerCase().trim();

        for (const a of doc.select("a")) {
            const href = a.attr("href") || "";
            const name = (a.text || "").replace(/\s+/g, " ").trim();
            const link = this.absoluteUrl(href);
            if (!name || !link.includes("/yaoi/") || link.includes("/ler/")) continue;
            if (wanted && !name.toLowerCase().includes(wanted)) continue;
            if (seen[link]) continue;
            seen[link] = true;
            list.push({name, link, imageUrl: this.imageUrl(a)});
        }

        const novels = list.filter(x => x.name.toLowerCase().includes("novel"));
        return {list: novels.length ? novels : list, hasNextPage: false};
    }

    async getDetail(url) {
        const doc = await this.fetch(url);
        const h1 = doc.selectFirst("h1");
        const name = h1 ? h1.text.replace(/\s+/g, " ").trim() : url;

        let description = "";
        const meta = doc.selectFirst('meta[name="description"]');
        if (meta) description = (meta.attr("content") || "").trim();
        if (!description) {
            for (const selector of [".sinopse", ".summary", ".description", ".entry-content p"]) {
                const el = doc.selectFirst(selector);
                if (el && el.text.trim().length > 30) {
                    description = el.text.replace(/\s+/g, " ").trim();
                    break;
                }
            }
        }

        const chapters = [];
        const seen = {};
        for (const a of doc.select("a")) {
            const href = a.attr("href") || "";
            const text = (a.text || "").replace(/\s+/g, " ").trim();
            const link = this.absoluteUrl(href);
            if (!link.includes("/ler/") || !/cap[ií]tulo/i.test(text) || seen[link]) continue;
            seen[link] = true;
            chapters.push({name: text, url: link, scanlator: "BR Yaoi"});
        }

        return {
            name,
            link: url,
            imageUrl: this.imageUrl(doc),
            description,
            author: "",
            genre: ["Novel", "PT-BR"],
            status: 1,
            chapters: chapters.reverse()
        };
    }

    async getHtmlContent(name, url) {
        const doc = await this.fetch(url);
        for (const selector of [
            ".entry-content", ".reading-content", ".chapter-content",
            ".post-content", "article .content", "article"
        ]) {
            const content = doc.selectFirst(selector);
            if (content && content.text.trim().length > 100) return content.outerHtml;
        }
        throw new Error("Não foi possível localizar o texto do capítulo no BR Yaoi.");
    }

    async cleanHtmlContent(html) {
        const doc = new Document(html);
        for (const selector of [
            ".sharedaddy", ".jp-relatedposts", ".post-navigation",
            ".navigation", ".comments", ".comment-respond",
            "script", "style", "noscript", "iframe"
        ]) {
            for (const el of doc.select(selector)) el.remove();
        }
        const root = doc.selectFirst(".entry-content") || doc.selectFirst("article") || doc.selectFirst("body");
        return root ? root.outerHtml : html;
    }

    getFilterList() {
        throw new Error("getFilterList not implemented");
    }

    getSourcePreferences() {
        throw new Error("getSourcePreferences not implemented");
    }
}
