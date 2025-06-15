import {
  Component,
  ElementRef,
  ViewChild,
  OnInit,
  NgZone,
} from "@angular/core";
import * as pdfjsLib from "pdfjs-dist";

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  @ViewChild("pdfContainer", { static: true })
  pdfContainer!: ElementRef<HTMLDivElement>;

  pdfDocument: any;
  totalPages = 0;
  currentPage = 1;
  scale = 1.5;

  observer!: IntersectionObserver;
  renderedPages: Set<number> = new Set();
  renderHistory: number[] = [];
  pageElements: Map<number, HTMLDivElement> = new Map();

  constructor(private ngZone: NgZone) {}

  async ngOnInit(): Promise<void> {
    const pdfjs = pdfjsLib as any;
    pdfjs.GlobalWorkerOptions.workerSrc = "/assets/pdf.worker.min.mjs";

    const loadingTask = pdfjs.getDocument("/assets/Spring_AI.pdf");
    this.pdfDocument = await loadingTask.promise;
    this.totalPages = this.pdfDocument.numPages;

    this.setupScrollTracking();
    this.createPlaceholdersAndObserve();
  }

  createPlaceholdersAndObserve() {
    const container = this.pdfContainer.nativeElement;

    for (let i = 1; i <= this.totalPages; i++) {
      const wrapper = document.createElement("div");
      wrapper.dataset['page'] = i.toString();
      wrapper.style.minHeight = "900px";
      wrapper.style.marginBottom = "20px";

      container.appendChild(wrapper);
      this.pageElements.set(i, wrapper);
      this.observer.observe(wrapper);
    }
  }

  setupScrollTracking() {
    this.ngZone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          const visiblePages = new Set<number>();

          entries.forEach((entry) => {
            const page = parseInt(entry.target.getAttribute("data-page")!, 10);

            if (entry.isIntersecting) {
              visiblePages.add(page);

              this.ngZone.run(() => {
                this.currentPage = page;
              });

              if (!this.renderedPages.has(page)) {
                this.renderPage(page, entry.target as HTMLDivElement);
              }
            }
          });

          // Pré-renderiza anterior e próxima
          visiblePages.forEach((page) => {
            [page - 1, page + 1].forEach((p) => {
              if (p >= 1 && p <= this.totalPages && !this.renderedPages.has(p)) {
                const el = this.pageElements.get(p);
                if (el) this.renderPage(p, el);
              }
            });
          });
        },
        {
          root: null,
          rootMargin: "400px 0px",
          threshold: 0.1,
        }
      );
    });
  }

  async renderPage(pageNumber: number, container: HTMLDivElement) {
    try {
      const page = await this.pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: this.scale });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d")!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      container.innerHTML = "";
      container.appendChild(canvas);

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
      this.renderedPages.add(pageNumber);
      this.renderHistory.push(pageNumber);

      // 🧹 Mantém no máximo 6 páginas renderizadas
      if (this.renderHistory.length > 6) {
        const oldest = this.renderHistory.shift();
        if (oldest !== undefined && this.renderedPages.has(oldest)) {
          const el = this.pageElements.get(oldest);
          if (el) el.innerHTML = "";
          this.renderedPages.delete(oldest);
        }
      }
    } catch (error) {
      console.error(`Erro ao renderizar página ${pageNumber}:`, error);
    }
  }
}
