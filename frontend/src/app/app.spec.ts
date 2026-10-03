import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';
import { routes } from './app.routes';
import { TOOLS } from './models/tool';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('renders the shell with a skip link and main landmark', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.skip-link')?.textContent).toContain('Skip to main content');
    expect(element.querySelector('main#main')).toBeTruthy();
    expect(element.querySelector('app-site-header')).toBeTruthy();
  });
});

describe('Tool registry', () => {
  it('routes every available tool', () => {
    const routedPaths = routes.map((route) => route.path);
    for (const tool of TOOLS.filter((t) => t.status === 'available')) {
      expect(routedPaths).toContain(tool.path);
    }
  });
});
