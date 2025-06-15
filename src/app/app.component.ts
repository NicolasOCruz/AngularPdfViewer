import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
} from "@angular/core";
import { RouterOutlet } from "@angular/router";
import * as pdfjsLib from "pdfjs-dist";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild("pdfContainer", { static: true })
  pdfContainer!: ElementRef<HTMLDivElement>;
  private pdfDocument: any;
  private currentPageNumber = 1;
  private scale = 1.5;
  totalPages = 0;
  currentPage = 1;

  constructor() {}

  ngOnInit(): void {
    this.loadPdf();
  }

  ngOnDestroy(): void {
    // Clean up resources when the component is destroyed.
  }

  // Load the PDF file.
  async loadPdf() {
    try {
      const pdfjs = pdfjsLib as any;
      pdfjs.GlobalWorkerOptions.workerSrc = "/assets/pdf.worker.min.mjs";

      const loadingTask = pdfjs.getDocument("/assets/Spring_AI.pdf"); // Path to your PDF file.
      this.pdfDocument = await loadingTask.promise;
      this.totalPages = this.pdfDocument.numPages;
      this.renderPage(this.currentPageNumber);
    } catch (error) {
      console.error("Error loading PDF:", error);
    }
  }

  // Render a specific page of the PDF.
  async renderPage(pageNumber: number) {
    const page = await this.pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale: this.scale });

    const container = this.pdfContainer.nativeElement;
    container.innerHTML = ""; // Clear previous content

    const canvas = document.createElement("canvas");
    container.appendChild(canvas);

    const context = canvas.getContext("2d")!;
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;
  }

  // Navigate to the previous page.
  goToPrevPage() {
    if (this.currentPageNumber > 1) {
      this.currentPageNumber--;
      this.currentPage = this.currentPageNumber;
      this.renderPage(this.currentPageNumber);
    }
  }

  // Navigate to the next page.
  goToNextPage() {
    if (this.currentPageNumber < this.totalPages) {
      this.currentPageNumber++;
      this.currentPage = this.currentPageNumber;
      this.renderPage(this.currentPageNumber);
    }
  }

  // Zoom in to the PDF.
  zoomIn() {
    this.scale += 0.25;
    this.renderPage(this.currentPageNumber);
  }

  // Zoom out of the PDF.
  zoomOut() {
    if (this.scale > 0.5) {
      this.scale -= 0.25;
      this.renderPage(this.currentPageNumber);
    }
  }
}