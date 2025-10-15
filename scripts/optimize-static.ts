import fs from 'fs';
import path from 'path';
import { minify } from 'html-minifier-terser';

interface OptimizationStats {
    originalSize: number;
    optimizedSize: number;
    savings: number;
    savingsPercent: number;
}

class StaticOptimizer {
    private publicDir = path.join(process.cwd(), 'public');
    private optimizedDir = path.join(process.cwd(), 'public', 'optimized');

    async optimizeStaticAssets(): Promise<void> {
        console.log('🎨 ОПТИМИЗАЦИЯ СТАТИЧЕСКИХ РЕСУРСОВ');
        console.log('='.repeat(50));

        // Создаем папку для оптимизированных файлов
        if (!fs.existsSync(this.optimizedDir)) {
            fs.mkdirSync(this.optimizedDir, { recursive: true });
        }

        const totalStats: OptimizationStats = {
            originalSize: 0,
            optimizedSize: 0,
            savings: 0,
            savingsPercent: 0
        };

        // Оптимизируем HTML файлы
        await this.optimizeHtmlFiles(totalStats);

        // Оптимизируем CSS файлы
        await this.optimizeCssFiles(totalStats);

        // Оптимизируем JavaScript файлы
        await this.optimizeJsFiles(totalStats);

        // Создаем манифест для кэширования
        await this.createCacheManifest();

        // Выводим итоговую статистику
        this.printTotalStats(totalStats);
    }

    private async optimizeHtmlFiles(totalStats: OptimizationStats): Promise<void> {
        console.log('\n📄 Оптимизация HTML файлов...');

        const htmlFiles = this.findFiles(this.publicDir, '.html');
        
        for (const file of htmlFiles) {
            const content = fs.readFileSync(file, 'utf8');
            const originalSize = Buffer.byteLength(content, 'utf8');

            try {
                const minified = await minify(content, {
                    removeComments: true,
                    collapseWhitespace: true,
                    collapseBooleanAttributes: true,
                    removeAttributeQuotes: true,
                    removeRedundantAttributes: true,
                    useShortDoctype: true,
                    removeEmptyAttributes: true,
                    minifyJS: true,
                    minifyCSS: true
                });

                const optimizedSize = Buffer.byteLength(minified, 'utf8');
                const savings = originalSize - optimizedSize;
                const savingsPercent = (savings / originalSize) * 100;

                // Сохраняем оптимизированную версию
                const fileName = path.basename(file);
                const optimizedPath = path.join(this.optimizedDir, fileName);
                fs.writeFileSync(optimizedPath, minified);

                console.log(`   ✅ ${fileName}: ${originalSize} → ${optimizedSize} bytes (-${savingsPercent.toFixed(1)}%)`);

                totalStats.originalSize += originalSize;
                totalStats.optimizedSize += optimizedSize;

            } catch (error) {
                console.log(`   ❌ Ошибка оптимизации ${file}: ${(error as Error).message}`);
            }
        }
    }

    private async optimizeCssFiles(totalStats: OptimizationStats): Promise<void> {
        console.log('\n🎨 Оптимизация CSS файлов...');

        const cssFiles = this.findFiles(this.publicDir, '.css');
        
        for (const file of cssFiles) {
            const content = fs.readFileSync(file, 'utf8');
            const originalSize = Buffer.byteLength(content, 'utf8');

            // Простая CSS минификация (удаление комментариев и лишних пробелов)
            const minified = content
                .replace(/\/\*[\s\S]*?\*\//g, '') // Удаляем комментарии
                .replace(/\s+/g, ' ') // Заменяем множественные пробелы одним
                .replace(/;\s*}/g, '}') // Удаляем последнюю точку с запятой перед }
                .replace(/\s*{\s*/g, '{') // Убираем пробелы вокруг {
                .replace(/;\s*/g, ';') // Убираем пробелы после ;
                .replace(/,\s*/g, ',') // Убираем пробелы после ,
                .trim();

            const optimizedSize = Buffer.byteLength(minified, 'utf8');
            const savings = originalSize - optimizedSize;
            const savingsPercent = (savings / originalSize) * 100;

            // Сохраняем оптимизированную версию
            const fileName = path.basename(file);
            const optimizedPath = path.join(this.optimizedDir, fileName);
            fs.writeFileSync(optimizedPath, minified);

            console.log(`   ✅ ${fileName}: ${originalSize} → ${optimizedSize} bytes (-${savingsPercent.toFixed(1)}%)`);

            totalStats.originalSize += originalSize;
            totalStats.optimizedSize += optimizedSize;
        }
    }

    private async optimizeJsFiles(totalStats: OptimizationStats): Promise<void> {
        console.log('\n⚡ Оптимизация JavaScript файлов...');

        const jsFiles = this.findFiles(this.publicDir, '.js');
        
        for (const file of jsFiles) {
            const content = fs.readFileSync(file, 'utf8');
            const originalSize = Buffer.byteLength(content, 'utf8');

            // Простая JS минификация (удаление комментариев и лишних пробелов)
            const minified = content
                .replace(/\/\/.*$/gm, '') // Удаляем однострочные комментарии
                .replace(/\/\*[\s\S]*?\*\//g, '') // Удаляем многострочные комментарии
                .replace(/\s+/g, ' ') // Заменяем множественные пробелы одним
                .replace(/\s*([{}();,])\s*/g, '$1') // Убираем пробелы вокруг операторов
                .trim();

            const optimizedSize = Buffer.byteLength(minified, 'utf8');
            const savings = originalSize - optimizedSize;
            const savingsPercent = (savings / originalSize) * 100;

            // Сохраняем оптимизированную версию
            const fileName = path.basename(file);
            const optimizedPath = path.join(this.optimizedDir, fileName);
            fs.writeFileSync(optimizedPath, optimizedSize > 0 ? minified : content);

            console.log(`   ✅ ${fileName}: ${originalSize} → ${optimizedSize} bytes (-${savingsPercent.toFixed(1)}%)`);

            totalStats.originalSize += originalSize;
            totalStats.optimizedSize += optimizedSize;
        }
    }

    private async createCacheManifest(): Promise<void> {
        console.log('\n📋 Создание манифеста кэширования...');

        const manifest = {
            version: Date.now(),
            assets: [] as Array<{
                path: string;
                hash: string;
                size: number;
                mimeType: string;
                cacheControl: string;
            }>
        };

        // Сканируем все файлы в public
        const allFiles = this.findAllFiles(this.publicDir);
        
        for (const file of allFiles) {
            const relativePath = path.relative(this.publicDir, file);
            const content = fs.readFileSync(file);
            const hash = require('crypto').createHash('md5').update(content).digest('hex');
            const ext = path.extname(file).toLowerCase();
            
            let mimeType = 'application/octet-stream';
            let cacheControl = 'public, max-age=3600';

            // Определяем MIME типы и политики кэширования
            switch (ext) {
                case '.html':
                    mimeType = 'text/html';
                    cacheControl = 'public, max-age=300'; // 5 минут
                    break;
                case '.css':
                    mimeType = 'text/css';
                    cacheControl = 'public, max-age=31536000, immutable'; // 1 год
                    break;
                case '.js':
                    mimeType = 'application/javascript';
                    cacheControl = 'public, max-age=31536000, immutable'; // 1 год
                    break;
                case '.png':
                    mimeType = 'image/png';
                    cacheControl = 'public, max-age=31536000, immutable';
                    break;
                case '.jpg':
                case '.jpeg':
                    mimeType = 'image/jpeg';
                    cacheControl = 'public, max-age=31536000, immutable';
                    break;
                case '.svg':
                    mimeType = 'image/svg+xml';
                    cacheControl = 'public, max-age=31536000, immutable';
                    break;
                case '.woff':
                    mimeType = 'font/woff';
                    cacheControl = 'public, max-age=31536000, immutable';
                    break;
                case '.woff2':
                    mimeType = 'font/woff2';
                    cacheControl = 'public, max-age=31536000, immutable';
                    break;
            }

            manifest.assets.push({
                path: relativePath.replace(/\\/g, '/'),
                hash: hash.substring(0, 8),
                size: content.length,
                mimeType,
                cacheControl
            });
        }

        const manifestPath = path.join(this.optimizedDir, 'asset-manifest.json');
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

        console.log(`   ✅ Манифест создан: ${manifest.assets.length} файлов`);
        console.log(`   📄 Сохранен в: ${manifestPath}`);
    }

    private findFiles(dir: string, extension: string): string[] {
        const files: string[] = [];
        
        const scanDir = (currentDir: string) => {
            const items = fs.readdirSync(currentDir, { withFileTypes: true });
            
            for (const item of items) {
                const fullPath = path.join(currentDir, item.name);
                
                if (item.isDirectory() && item.name !== 'optimized') {
                    scanDir(fullPath);
                } else if (item.isFile() && fullPath.endsWith(extension)) {
                    files.push(fullPath);
                }
            }
        };

        scanDir(dir);
        return files;
    }

    private findAllFiles(dir: string): string[] {
        const files: string[] = [];
        
        const scanDir = (currentDir: string) => {
            const items = fs.readdirSync(currentDir, { withFileTypes: true });
            
            for (const item of items) {
                const fullPath = path.join(currentDir, item.name);
                
                if (item.isDirectory() && item.name !== 'optimized') {
                    scanDir(fullPath);
                } else if (item.isFile()) {
                    files.push(fullPath);
                }
            }
        };

        scanDir(dir);
        return files;
    }

    private printTotalStats(stats: OptimizationStats): void {
        stats.savings = stats.originalSize - stats.optimizedSize;
        stats.savingsPercent = (stats.savings / stats.originalSize) * 100;

        console.log('\n📊 ИТОГОВАЯ СТАТИСТИКА ОПТИМИЗАЦИИ:');
        console.log('='.repeat(50));
        console.log(`📦 Исходный размер: ${(stats.originalSize / 1024).toFixed(2)} KB`);
        console.log(`🗜️ Оптимизированный: ${(stats.optimizedSize / 1024).toFixed(2)} KB`);
        console.log(`💾 Экономия: ${(stats.savings / 1024).toFixed(2)} KB (-${stats.savingsPercent.toFixed(1)}%)`);
        
        if (stats.savingsPercent > 30) {
            console.log('🎉 ОТЛИЧНО! Значительная оптимизация');
        } else if (stats.savingsPercent > 15) {
            console.log('✅ ХОРОШО! Заметное улучшение');
        } else {
            console.log('📝 Файлы уже достаточно оптимизированы');
        }

        console.log('\n🚀 Преимущества оптимизации:');
        console.log('   ⚡ Быстрая загрузка страниц');
        console.log('   📱 Экономия мобильного трафика');
        console.log('   🌐 Лучший SEO рейтинг');
        console.log('   💰 Снижение CDN расходов');
    }
}

// Установка пакета html-minifier-terser если не установлен
async function ensureMinifier() {
    try {
        require('html-minifier-terser');
    } catch {
        console.log('📦 Установка html-minifier-terser...');
        const { execSync } = require('child_process');
        execSync('npm install html-minifier-terser', { stdio: 'inherit' });
    }
}

// Запуск оптимизации
async function main() {
    try {
        await ensureMinifier();
        
        const optimizer = new StaticOptimizer();
        await optimizer.optimizeStaticAssets();
        
        console.log('\n✅ Оптимизация завершена!');
    } catch (error) {
        console.error('❌ Ошибка оптимизации:', error);
        process.exit(1);
    }
}

main().catch(console.error);