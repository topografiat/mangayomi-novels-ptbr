const mangayomiSources = [{
    "name": "3X Yaoi - Novels",
    "lang": "pt",
    "baseUrl": "http://3xyaoi.com",
    "apiUrl": "",
    "iconUrl": "http://3xyaoi.com/favicon.ico",
    "typeSource": "single",
    "itemType": 2,
    "version": "0.1.0",
    "pkgPath": "javascript/novel/src/pt/3xyaoi.js",
    "notes": "Novels em português do 3X Yaoi."
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
        if (href.startsWith("//")) return "http:" + href;
        if (href.startsWith("/")) return this.source.baseUrl + href;
        return this.source.baseUrl + "/" + href;
    }

    async fetch(url) {
        const res = await new Client().get(url, this.getHeaders(url));
        if (res.statusCode !== 200) throw new Error("3X Yaoi retornou HTTP " + res.statusCode);
        return new Document(res.body);
    }

    imageUrl(element) {
        if (!element) return "";
        const img = element.selectFirst("img");
        if (img) {
            const src = img.attr("data-src") || img.attr("data-lazy-src") || img.attr("src");
            if (src && !src.includes("icon") && !src.includes("logo")) {
                return this.absoluteUrl(src);
            }
        }
        return "";
    }

    async getNovelList(page) {
        const n = page || 1;
        const url = n === 1
            ? this.source.baseUrl + "/"
            : this.source.baseUrl + "/page/" + n + "/";
        const doc = await this.fetch(url);
        const list = [];
        const seen = {};

        for (const a of doc.select("a")) {
            const href = a.attr("href") || "";
            const name = (a.text || "").replace(/\s+/g, " ").trim();
            const link = this.absoluteUrl(href);
            if (!name || link.includes("/page/") || link.includes("/author/") || link.includes("/category/") || link.includes("/tag/") || seen[link]) continue;
            seen[link] = true;
            list.push({name, link, imageUrl: this.imageUrl(a)});
        }

        return {list, hasNextPage: true};
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
            if (!name || seen[link]) continue;
            if (wanted && !name.toLowerCase().includes(wanted)) continue;
            seen[link] = true;
            list.push({name, link, imageUrl: this.imageUrl(a)});
        }

        return {list, hasNextPage: false};
    }

    async getDetail(url) {
        const doc = await this.fetch(url);
        const h1 = doc.selectFirst("h1");
        const name = h1 ? h1.text.replace(/\s+/g, " ").trim() : url;

        let description = "";
        const meta = doc.selectFirst('meta[name="description"]');
        if (meta) description = (meta.attr("content") || "").trim();

        let coverUrl = "";
        const ogImage = doc.selectFirst('meta[property="og:image"]');
        if (ogImage) coverUrl = ogImage.attr("content"] || "";

        const chapters = [];
        const seen = {};
        for (const a of doc.select("a")) {
            const href = a.attr("href") || "";
            const text = (a.text || "").replace(/\s+/g, " ").trim();
            const link = this.absoluteUrl(href);
            if (!/cap[ií]tulo/i.test(text) && !/pr[óo]logo/i.test(text) && !/extra/i.test(text) || seen[link]) continue;
            seen[link] = true;
            chapters.push({name: text, url: link, scanlator: "3X Yaoi"});
        }

        return {
            name,
            link: url,
            imageUrl: coverUrl,
            description,
            author: "",
            genre: ["Novel", "PT-BR"],
            status: 1,
            chapters: chapters.reverse()
        };
    }

    async getHtmlContent(name, url) {
        const doc = await this.fetch(url);
        
        const selectors = [
            ".entry-content", ".reading-content", ".chapter-content",
            ".post-content", "article", ".text-left", ".post-body"
        ];

        for (const selector of selectors) {
            const content = doc.selectFirst(selector);
            if (content && content.text.trim().length > 100) return content.outerHtml;
        }

        const paragraphs = doc.select("p");
        if (paragraphs.length > 5) {
            let combinedHtml = "";
            for (const p of paragraphs) {
                combinedHtml += p.outerHtml;
            }
            if (combinedHtml.length > 100) return combinedHtml;
        }

        throw new Error("Não foi possível localizar o texto do capítulo no 3X Yaoi.");
    }

    async cleanHtmlContent(html) {
        const doc = new Document(html);
        for (const selector of ["script", "style", "noscript", "iframe", ".sharedaddy"]) {
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
