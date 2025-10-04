import { ActivityService } from '../services/ActivityService';

export class Preferences {
    private container: HTMLElement;
    private activityService: ActivityService;
    private selectedActivities: string[] = [];
    private storageKey = 'user-activity-preferences';

    private activityEmojis: { [key: string]: string } = {
        hiking: '🥾',
        skiing: '⛷️',
        camping: '⛺',
        cycling: '🚴',
        fishing: '🎣',
        kayaking: '🛶',
        surfing: '🏄',
        running: '🏃',
        default: '➡️'
    };

    constructor(containerId: string) {
        this.container = document.getElementById(containerId)!;
        this.activityService = new ActivityService();
        this.loadPreferences();
        this.render();
    }

    private render() {
        this.container.innerHTML = ''; // Clear previous content

        const heading = document.createElement('h3');
        heading.classList.add('preferences-heading');
        heading.textContent = 'Activity Preferences';

        const activities = this.activityService.getAvailableActivities();

        const dropdownContainer = document.createElement('div');
        dropdownContainer.classList.add('preferences-container');

        const dropdownButton = document.createElement('button');
        dropdownButton.classList.add('preferences-button');
        dropdownButton.textContent = 'My ideal weather for...';

        const dropdownContent = document.createElement('div');
        dropdownContent.classList.add('preferences-content');

        activities.forEach(activity => {
            const itemContainer = document.createElement('div');
            itemContainer.classList.add('preference-item');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `pref-${activity}`;
            checkbox.name = activity;
            checkbox.value = activity;
            checkbox.checked = this.selectedActivities.includes(activity);
            checkbox.addEventListener('change', (e) => this.handleCheckboxChange(e));

            const label = document.createElement('label');
            label.htmlFor = `pref-${activity}`;
            const emoji = this.activityEmojis[activity] || this.activityEmojis.default;
            label.textContent = `${emoji} ${activity.charAt(0).toUpperCase() + activity.slice(1)}`;

            itemContainer.appendChild(checkbox);
            itemContainer.appendChild(label);
            dropdownContent.appendChild(itemContainer);

            if (checkbox.checked) {
                itemContainer.classList.add('checked');
            }

            itemContainer.addEventListener('click', () => {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            });
        });

        dropdownContainer.appendChild(dropdownButton);
        dropdownContainer.appendChild(dropdownContent);

        this.container.appendChild(heading);
        this.container.appendChild(dropdownContainer);
        
        dropdownButton.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownContent.classList.toggle('show');
        });

        window.addEventListener('click', () => {
            if (!dropdownContainer.contains(event.target as Node)) {
                dropdownContent.classList.remove('show');
            }
        });
    }

    private handleCheckboxChange(event: Event) {
        const checkbox = event.target as HTMLInputElement;
        const itemContainer = checkbox.parentElement;
        if (checkbox.checked) {
            if (!this.selectedActivities.includes(checkbox.value)) {
                this.selectedActivities.push(checkbox.value);
            }
            itemContainer?.classList.add('checked');
        } else {
            this.selectedActivities = this.selectedActivities.filter(activity => activity !== checkbox.value);
            itemContainer?.classList.remove('checked');
        }
        this.savePreferences();
        console.log('Selected Activities:', this.selectedActivities);
    }

    private savePreferences() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.selectedActivities));
    }

    private loadPreferences() {
        const savedPreferences = localStorage.getItem(this.storageKey);
        if (savedPreferences) {
            this.selectedActivities = JSON.parse(savedPreferences);
        }
    }
}