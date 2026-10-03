import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

import { TOOLS } from '../../models/tool';
import { Icon } from '../../shared/components/icon/icon';

@Component({
  selector: 'app-home',
  imports: [RouterLink, NgTemplateOutlet, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  protected readonly tools = TOOLS;
}
