const mangayomiSources = [{
    "name": "BL Novels",
    "lang": "pt",
    "baseUrl": "https://blnovels.com",
    "apiUrl": "",
    "iconUrl": "https://blnovels.com/favicon.ico",
    "typeSource": "single",
    "itemType": 2,
    "version": "0.1.6",
    "pkgPath": "novel/src/pt/blnovels.js",
    "notes": "Novels em português do BL Novels."
}];

class DefaultExtension extends MProvider {

    getHeaders() {
        return {
            "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
            "Referer": "https://blnovels.com/"
        };
    }

    absoluteUrl(url) {
        if (!url) return "";

        url = url.trim();

        if (
            url.indexOf("http://") === 0 ||
            url.indexOf("https://") === 0
        ) {
            return url;
        }

        if (url.indexOf("//") === 0) {
            return "https:" + url;
        }

        if (url.indexOf("/") === 0) {
            return this.source.baseUrl + url;
        }

        return this.source.baseUrl + "/" + url;
    }

    async fetchDocument(url) {
        const client = new Client();

        const response = await client.get(
            url,
            this.getHeaders()
        );

        if (response.statusCode !== 200) {
            throw new Error(
                "BL Novels retornou HTTP " +
                response.statusCode
            );
        }

        return new Document(response.body);
    }

    cleanText(text) {
        if (!text) return "";

        return text
            .replace(/\s+/g, " ")
            .trim();
    }

    isBadTitle(text) {
        if (!text) return true;

        const value =
            this.cleanText(text).toLowerCase();

        const badTitles = [
            "concluído",
            "concluido",
            "em andamento",
            "18+",
            "18 +",
            "novo",
            "ler",
            "ler do início",
            "ler do inicio",
            "último capítulo",
            "ultimo capítulo",
            "último capitulo",
            "ultimo capitulo"
        ];

        for (let i = 0; i < badTitles.length; i++) {
            if (value === badTitles[i]) {
                return true;
            }
        }

        return false;
    }

    getImageFromElement(element) {
        if (!element) return "";

        const img =
            element.selectFirst("img");

        if (!img) return "";

        let url = "";

        url = img.attr("data-src") || "";

        if (!url) {
            url = img.attr("data-lazy-src") || "";
        }

        if (!url) {
            url = img.attr("data-original") || "";
        }

        if (!url) {
            url = img.attr("data-original-src") || "";
        }

        if (!url) {
            url = img.attr("data-image") || "";
        }

        if (!url) {
            url = img.attr("src") || "";
        }

        if (!url) return "";

        const lower =
            url.toLowerCase();

        if (
            lower.indexOf("logo") >= 0 ||
            lower.indexOf("favicon") >= 0 ||
            lower.indexOf("avatar") >= 0
        ) {
            return "";
        }

        return this.absoluteUrl(url);
    }

    getOpenGraphImage(doc) {

        const selectors = [
            'meta[property="og:image"]',
            'meta[property="og:image:url"]',
            'meta[name="twitter:image"]'
        ];

        for (
            let i = 0;
            i < selectors.length;
            i++
        ) {

            const meta =
                doc.selectFirst(
                    selectors[i]
                );

            if (!meta) continue;

            const value =
                meta.attr("content") || "";

            if (!value) continue;

            const lower =
                value.toLowerCase();

            if (
                lower.indexOf("logo") >= 0 ||
                lower.indexOf("favicon") >= 0
            ) {
                continue;
            }

            return this.absoluteUrl(value);
        }

        return "";
    }

    getPageImage(doc) {

        let image =
            this.getOpenGraphImage(doc);

        if (image) {
            return image;
        }

        const selectors = [
            ".summary_image img",
            ".tab-summary img",
            ".c-tabs-item__content img",
            ".page-item-detail img",
            ".item-summary img",
            ".post-title img",
            "article img"
        ];

        for (
            let i = 0;
            i < selectors.length;
            i++
        ) {

            const element =
                doc.selectFirst(
                    selectors[i]
                );

            if (!element) continue;

            let url = "";

            url =
                element.attr("data-src") || "";

            if (!url) {
                url =
                    element.attr("data-lazy-src") || "";
            }

            if (!url) {
                url =
                    element.attr("data-original") || "";
            }

            if (!url) {
                url =
                    element.attr("data-original-src") || "";
            }

            if (!url) {
                url =
                    element.attr("src") || "";
            }

            if (!url) continue;

            const lower =
                url.toLowerCase();

            if (
                lower.indexOf("logo") >= 0 ||
                lower.indexOf("favicon") >= 0 ||
                lower.indexOf("avatar") >= 0
            ) {
                continue;
            }

            return this.absoluteUrl(url);
        }

        return "";
    }

    isNovelUrl(url) {

        if (!url) return false;

        if (
            url.indexOf(
                this.source.baseUrl +
                "/novel/"
            ) !== 0
        ) {
            return false;
        }

        const part =
            url.substring(
                (
                    this.source.baseUrl +
                    "/novel/"
                ).length
            );

        const pieces =
            part
                .split("/")
                .filter(function(item) {
                    return item.trim() !== "";
                });

        return pieces.length === 1;
    }

    isChapterUrl(url, novelUrl) {

        if (!url || !novelUrl) {
            return false;
        }

        let base = novelUrl;

        if (
            base.charAt(
                base.length - 1
            ) !== "/"
        ) {
            base += "/";
        }

        if (
            url.indexOf(base) !== 0
        ) {
            return false;
        }

        const rest =
            url.substring(
                base.length
            );

        if (!rest) {
            return false;
        }

        const pieces =
            rest
                .split("/")
                .filter(function(item) {
                    return item.trim() !== "";
                });

        return pieces.length > 0;
    }

    async getNovelInfo(url) {

        try {

            const doc =
                await this.fetchDocument(url);

            let name = "";

            const h1 =
                doc.selectFirst("h1");

            if (h1) {
                name =
                    this.cleanText(
                        h1.text || ""
                    );
            }

            if (
                !name ||
                this.isBadTitle(name)
            ) {

                const title =
                    doc.selectFirst(
                        "title"
                    );

                if (title) {

                    name =
                        this.cleanText(
                            title.text || ""
                        );

                    name =
                        name
                            .replace(
                                /\s*-\s*BL\s*Novels.*$/i,
                                ""
                            )
                            .trim();
                }
            }

            const imageUrl =
                this.getPageImage(doc);

            return {
                name: name,
                imageUrl: imageUrl
            };

        } catch (e) {

            return {
                name: "",
                imageUrl: ""
            };
        }
    }

    async getNovelList(page) {

        const currentPage =
            page || 1;

        let url =
            this.source.baseUrl + "/";

        if (currentPage > 1) {
            url =
                this.source.baseUrl +
                "/page/" +
                currentPage +
                "/";
        }

        const doc =
            await this.fetchDocument(url);

        const result = [];
        const seen = {};

        const articles =
            doc.select("article");

        for (
            let i = 0;
            i < articles.length;
            i++
        ) {

            const article =
                articles[i];

            const links =
                article.select("a");

            let novelLink = "";

            for (
                let j = 0;
                j < links.length;
                j++
            ) {

                const href =
                    links[j].attr("href") || "";

                const link =
                    this.absoluteUrl(href);

                if (
                    this.isNovelUrl(link)
                ) {
                    novelLink = link;
                    break;
                }
            }

            if (!novelLink) {
                continue;
            }

            if (seen[novelLink]) {
                continue;
            }

            let name = "";

            const titleSelectors = [
                "h3 a",
                "h2 a",
                "h4 a",
                ".post-title a",
                ".item-summary h3 a",
                ".item-summary h2 a",
                ".post-title"
            ];

            for (
                let j = 0;
                j < titleSelectors.length;
                j++
            ) {

                const titleElement =
                    article.selectFirst(
                        titleSelectors[j]
                    );

                if (!titleElement) {
                    continue;
                }

                const candidate =
                    this.cleanText(
                        titleElement.text || ""
                    );

                if (
                    candidate &&
                    !this.isBadTitle(
                        candidate
                    )
                ) {
                    name = candidate;
                    break;
                }
            }

            if (!name) {

                for (
                    let j = 0;
                    j < links.length;
                    j++
                ) {

                    const href =
                        links[j].attr(
                            "href"
                        ) || "";

                    const link =
                        this.absoluteUrl(
                            href
                        );

                    if (
                        link !== novelLink
                    ) {
                        continue;
                    }

                    const candidate =
                        this.cleanText(
                            links[j].text || ""
                        );

                    if (
                        candidate &&
                        !this.isBadTitle(
                            candidate
                        )
                    ) {
                        name = candidate;
                        break;
                    }
                }
            }

            let imageUrl =
                this.getImageFromElement(
                    article
                );

            if (
                !name ||
                this.isBadTitle(name) ||
                !imageUrl
            ) {

                const info =
                    await this.getNovelInfo(
                        novelLink
                    );

                if (
                    info.name &&
                    !this.isBadTitle(
                        info.name
                    )
                ) {
                    name = info.name;
                }

                if (
                    !imageUrl &&
                    info.imageUrl
                ) {
                    imageUrl =
                        info.imageUrl;
                }
            }

            if (!name) {
                continue;
            }

            seen[novelLink] = true;

            result.push({
                name: name,
                link: novelLink,
                imageUrl: imageUrl
            });
        }

        if (result.length === 0) {

            const links =
                doc.select("a");

            for (
                let i = 0;
                i < links.length;
                i++
            ) {

                const href =
                    links[i].attr(
                        "href"
                    ) || "";

                const link =
                    this.absoluteUrl(href);

                if (
                    !this.isNovelUrl(link)
                ) {
                    continue;
                }

                if (seen[link]) {
                    continue;
                }

                const info =
                    await this.getNovelInfo(
                        link
                    );

                if (!info.name) {
                    continue;
                }

                seen[link] = true;

                result.push({
                    name: info.name,
                    link: link,
                    imageUrl: info.imageUrl
                });
            }
        }

        let hasNextPage =
            false;

        const pageLinks =
            doc.select("a");

        for (
            let i = 0;
            i < pageLinks.length;
            i++
        ) {

            const href =
                pageLinks[i].attr(
                    "href"
                ) || "";

            const text =
                this.cleanText(
                    pageLinks[i].text || ""
                ).toLowerCase();

            if (
                href.indexOf(
                    "/page/" +
                    (currentPage + 1) +
                    "/"
                ) >= 0
            ) {
                hasNextPage = true;
                break;
            }

            if (
                text ===
                    "posts mais antigos" ||
                text === "próxima" ||
                text === "next"
            ) {
                hasNextPage = true;
                break;
            }
        }

        return {
            list: result,
            hasNextPage: hasNextPage
        };
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

        const currentPage =
            page || 1;

        let url =
            this.source.baseUrl +
            "/?s=" +
            encodeURIComponent(query);

        if (currentPage > 1) {
            url +=
                "&paged=" +
                currentPage;
        }

        const doc =
            await this.fetchDocument(
                url
            );

        const result = [];
        const seen = {};

        const links =
            doc.select("a");

        for (
            let i = 0;
            i < links.length;
            i++
        ) {

            const href =
                links[i].attr(
                    "href"
                ) || "";

            const link =
                this.absoluteUrl(href);

            if (
                !this.isNovelUrl(link)
            ) {
                continue;
            }

            if (seen[link]) {
                continue;
            }

            const info =
                await this.getNovelInfo(
                    link
                );

            if (!info.name) {
                continue;
            }

            seen[link] = true;

            result.push({
                name: info.name,
                link: link,
                imageUrl: info.imageUrl
            });
        }

        return {
            list: result,
            hasNextPage: false
        };
    }

    async getDetail(url) {

        const doc =
            await this.fetchDocument(
                url
            );

        let name = "";

        const h1 =
            doc.selectFirst("h1");

        if (h1) {
            name =
                this.cleanText(
                    h1.text || ""
                );
        }

        if (!name) {

            const title =
                doc.selectFirst(
                    "title"
                );

            if (title) {

                name =
                    this.cleanText(
                        title.text || ""
                    );

                name =
                    name.replace(
                        /\s*-\s*BL\s*Novels.*$/i,
                        ""
                    ).trim();
            }
        }

        /*
         * SINOPSE
         *
         * O BL Novels possui uma seção
         * chamada "Sinopse".
         */
        let description = "";

        const allElements =
            doc.select(
                "h1, h2, h3, h4, h5, h6, p, div"
            );

        let synopsisStarted = false;
        const synopsisParts = [];

        for (
            let i = 0;
            i < allElements.length;
            i++
        ) {

            const element =
                allElements[i];

            const text =
                this.cleanText(
                    element.text || ""
                );

            if (!text) {
                continue;
            }

            const lower =
                text.toLowerCase();

            /*
             * Início da sinopse.
             */
            if (
                lower === "sinopse" ||
                lower === "sinopse:"
            ) {
                synopsisStarted = true;
                continue;
            }

            if (!synopsisStarted) {
                continue;
            }

            /*
             * Fim da sinopse.
             */
            if (
                lower === "publicado por:" ||
                lower === "publicado por" ||
                lower === "últimos lançamentos" ||
                lower === "ultimos lançamentos" ||
                lower === "manga discussion" ||
                lower === "tags:"
            ) {
                break;
            }

            /*
             * Ignora títulos pequenos.
             */
            if (text.length < 20) {
                continue;
            }

            /*
             * Evita duplicação.
             */
            if (
                synopsisParts.length === 0 ||
                synopsisParts[
                    synopsisParts.length - 1
                ] !== text
            ) {
                synopsisParts.push(text);
            }
        }

        if (synopsisParts.length > 0) {
            description =
                synopsisParts.join("\n\n");
        }

        /*
         * Fallback para meta description.
         */
        if (!description) {

            const meta =
                doc.selectFirst(
                    'meta[name="description"]'
                );

            if (meta) {
                description =
                    this.cleanText(
                        meta.attr("content") || ""
                    );
            }
        }

        let author = "";

        const authorElement =
            doc.selectFirst(
                ".author-content"
            );

        if (authorElement) {
            author =
                this.cleanText(
                    authorElement.text || ""
                );
        }

        /*
         * CAPÍTULOS
         *
         * Mantemos a lógica que já estava
         * funcionando na versão anterior.
         */
        const chapters = [];
        const seen = {};

        const links =
            doc.select("a");

        for (
            let i = 0;
            i < links.length;
            i++
        ) {

            const href =
                links[i].attr(
                    "href"
                ) || "";

            const link =
                this.absoluteUrl(href);

            if (
                !this.isChapterUrl(
                    link,
                    url
                )
            ) {
                continue;
            }

            if (seen[link]) {
                continue;
            }

            const chapterName =
                this.cleanText(
                    links[i].text || ""
                );

            if (!chapterName) {
                continue;
            }

            seen[link] = true;

            chapters.push({
                name: chapterName,
                url: link,
                scanlator: "BL Novels"
            });
        }

        chapters.reverse();

        return {
            name: name,
            link: url,
            imageUrl:
                this.getPageImage(doc),
            description: description,
            author: author,
            genre: [
                "Novel",
                "BL",
                "PT-BR"
            ],
            status: 1,
            chapters: chapters
        };
    }

    async getHtmlContent(name, url) {

        const doc =
            await this.fetchDocument(
                url
            );

        const selectors = [
            ".reading-content",
            ".entry-content",
            ".post-content",
            "article"
        ];

        for (
            let i = 0;
            i < selectors.length;
            i++
        ) {

            const content =
                doc.selectFirst(
                    selectors[i]
                );

            if (!content) {
                continue;
            }

            const text =
                this.cleanText(
                    content.text || ""
                );

            if (text.length > 100) {
                return content.outerHtml;
            }
        }

        const body =
            doc.selectFirst("body");

        if (body) {

            const text =
                this.cleanText(
                    body.text || ""
                );

            if (text.length > 100) {
                return body.outerHtml;
            }
        }

        throw new Error(
            "Não foi possível localizar o texto do capítulo no BL Novels."
        );
    }

    async cleanHtmlContent(html) {

        const doc =
            new Document(html);

        const removeSelectors = [
            "script",
            "style",
            "noscript",
            "iframe",
            "form"
        ];

        for (
            let i = 0;
            i < removeSelectors.length;
            i++
        ) {

            const elements =
                doc.select(
                    removeSelectors[i]
                );

            for (
                let j = 0;
                j < elements.length;
                j++
            ) {
                elements[j].remove();
            }
        }

        const content =
            doc.selectFirst(
                ".reading-content"
            ) ||
            doc.selectFirst(
                ".entry-content"
            ) ||
            doc.selectFirst(
                ".post-content"
            ) ||
            doc.selectFirst(
                "article"
            ) ||
            doc.selectFirst(
                "body"
            );

        if (content) {
            return content.outerHtml;
        }

        return html;
    }

    getFilterList() {
        throw new Error(
            "getFilterList not implemented."
        );
    }

    getSourcePreferences() {
        throw new Error(
            "getSourcePreferences not implemented."
        );
    }
}
