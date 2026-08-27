import { Component, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({selector:'app-home',standalone:true,imports:[RouterLink],encapsulation:ViewEncapsulation.None,templateUrl:'./home.component.html'})
export class HomeComponent {}
