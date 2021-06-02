/* 
	Still incomplete:
		+ Edit a workout											DONE!
		+ Delete a workout											DONE!
		+ Delete all workout UI										DONE!
		+ Sort workouts by a certain fields
		+ Re-build Running and Cycling objects from localStorage
		+ Create error and confirmation messages

		* Position map to show all workouts
		* Draw lines and shapes instead of just points
		* Geocode location from coordinates
		* Display weather data for workout time and place
*/
"use strict";

// prettier-ignore
// const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const form = document.querySelector(".form");
const containerWorkouts = document.querySelector(".workouts");
const inputType = document.querySelector(".form__input--type");
const inputDistance = document.querySelector(".form__input--distance");
const inputDuration = document.querySelector(".form__input--duration");
const inputCadence = document.querySelector(".form__input--cadence");
const inputElevation = document.querySelector(".form__input--elevation");
const resetBtn = document.querySelector(".reset__btn");

class Workout {
	constructor(coords, distance, duration, name) {
		this.date = new Date();
		this.id = String(Date.now());
		this.coords = coords; // [latitute, longitue]
		this.distance = distance; // km
		this.duration = duration; // min
		this.clicks = 0;
		this.name = name;

		this._setDescription();
	}

	_setDescription() {
		// prettier-ignore
		const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
		this.description = `${
			this.name[0].toUpperCase() + this.name.slice(1)
		} on ${months[this.date.getMonth()]} ${this.date.getDate()}`;
	}

	click() {
		this.clicks++;
	}
}

class Running extends Workout {
	constructor(coords, distance, duration, cadence) {
		super(coords, distance, duration, "running");
		this.cadence = cadence;
		this.calcPace();
	}

	calcPace() {
		this.pace = this.duration / this.distance;
		return this.pace;
	}
}

class Cycling extends Workout {
	constructor(coords, distance, duration, elevationGain) {
		super(coords, distance, duration, "cycling");
		this.elevationGain = elevationGain;
		this.calcSpeed();
	}

	calcSpeed() {
		this.speed = this.distance / (this.duration / 60);
		return this.speed;
	}
}

///////////////////////////////////////////////////////////
// Application Architecture
class App {
	#map;
	#mapZoomLevel = 13;
	#mapEvent;
	#workouts = [];
	#markers = [];

	constructor() {
		// Get user's position
		this._getPosition();

		// Get data from local storage
		this._getLocalstorage();

		// Attach event handler
		form.addEventListener("submit", this._newWorkout.bind(this));

		inputType.addEventListener("change", this._toggleElevationField);

		containerWorkouts.addEventListener(
			"click",
			this._moveToPopup.bind(this)
		);

		resetBtn.addEventListener("click", this.reset);
	}

	_getPosition() {
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
				this._loadMap.bind(this),
				(error) => alert("Could not get your location!")
			);
		}
	}

	_loadMap(coordinates) {
		const { latitude, longitude } = coordinates.coords;

		const coords = [latitude, longitude];
		this.#map = L.map("map").setView(coords, this.#mapZoomLevel);

		L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
			attribution:
				'&copy; <a href="https://www.openstreetmap.fr/hot/copyright">OpenStreetMap</a> contributors',
		}).addTo(this.#map);

		this.#map.on("click", this._showForm.bind(this));

		this.#workouts.forEach((work) => {
			this._renderWorkoutMarker(work);
		});
	}

	_showForm(mapE) {
		this.#mapEvent = mapE;
		form.classList.remove("hidden");
		inputDistance.focus();
	}

	_hideForm() {
		// Clear inputs
		// prettier-ignore
		inputDistance.value = inputCadence.value = inputDuration.value = inputElevation.value = "";

		form.style.display = "none";
		form.classList.add("hidden");
		setTimeout(() => (form.style.display = ""), 1000);
	}

	_toggleElevationField() {
		inputElevation
			.closest(".form__row")
			.classList.toggle("form__row--hidden");
		inputCadence
			.closest(".form__row")
			.classList.toggle("form__row--hidden");
	}

	_createWorkout(latlng, time, workoutId) {
		const validInputs = (...inputs) =>
			inputs.every((inp) => Number.isFinite(inp));
		const allPositive = (...inputs) => inputs.every((inp) => inp > 0);

		// Get data from form
		const type = inputType.value;
		const distance = +inputDistance.value;
		const duration = +inputDuration.value;
		let workout;
		// If workout is running, create a new running object
		if (type === "running") {
			const cadence = +inputCadence.value;
			// Check if data is valid
			if (
				!validInputs(distance, duration, cadence) ||
				!allPositive(distance, duration, cadence)
			) {
				return alert("Inputs must be a positive number!");
			}

			workout = new Running(latlng, distance, duration, cadence);
		}

		// If workout is cycling, create a new cycling object
		if (type === "cycling") {
			const elevation = +inputElevation.value;
			if (
				!validInputs(distance, duration, elevation) ||
				!allPositive(distance, duration)
			) {
				return alert("Inputs must be a positive number!");
			}
			workout = new Cycling(latlng, distance, duration, elevation);
		}

		// If update workout
		if (workoutId) {
			workout.id = workoutId;
			workout.date = time;
		}

		return workout;
	}

	_newWorkout(e) {
		e.preventDefault();

		const { lat, lng } = this.#mapEvent.latlng;
		const workout = this._createWorkout([lat, lng]);
		// Add new object to workout array
		this.#workouts.push(workout);

		// Render workout on map as marker
		this._renderWorkoutMarker(workout);

		// Render workout on list
		this._renderWorkout(workout);

		// Hide form + Clear input fields
		this._hideForm();

		// Set local storage to all workouts
		this._setLocalStorage();
	}

	_renderWorkout(workout, isUpdate) {
		let html = `<li class="workout workout--${workout.name}" data-id="${workout.id}">`;
		let innerHTML = `
			<h2 class="workout__title">${workout.description}</h2>
				<div class="workout__edit">
					<svg><use xlink:href="icons.svg#icon-edit"></use></svg>
				</div>
				<div class="workout__delete">
					<svg><use xlink:href="icons.svg#icon-delete"></use></svg>
				</div>
				<div class="workout__details">
				<span class="workout__icon">${workout.name === "running" ? "🏃‍♂️" : "🚴‍♀️"}</span>
				<span class="workout__value">${workout.distance}</span>
				<span class="workout__unit">km</span>
				</div>
				<div class="workout__details">
				<span class="workout__icon">⏱</span>
				<span class="workout__value">${workout.duration}</span>
				<span class="workout__unit">min</span>
				</div>
		`;

		if (workout.name === "running") {
			innerHTML += `
			<div class="workout__details">
				<span class="workout__icon">⚡️</span>
				<span class="workout__value">${workout.pace.toFixed(1)}</span>
				<span class="workout__unit">min/km</span>
			</div>
			<div class="workout__details">
				<span class="workout__icon">🦶🏼</span>
				<span class="workout__value">${workout.cadence}</span>
				<span class="workout__unit">spm</span>
			</div>
		`;
		} else if (workout.name === "cycling") {
			innerHTML += `
			<div class="workout__details">
				<span class="workout__icon">⚡️</span>
				<span class="workout__value">${workout.speed.toFixed(1)}</span>
				<span class="workout__unit">km/h</span>
			</div>
			<div class="workout__details">
				<span class="workout__icon">⛰</span>
				<span class="workout__value">${workout.elevationGain}</span>
				<span class="workout__unit">m</span>
			</div>
			`;
		}
		if (!isUpdate) {
			html += innerHTML + "</li>";
			form.insertAdjacentHTML("afterend", html);
		} else {
			return innerHTML;
		}
	}

	_renderWorkoutMarker(workout) {
		const marker = L.marker(workout.coords).addTo(this.#map);
		this.#markers.push(marker);
		this._createPopup(marker, workout);
	}

	_createPopup(marker, workout) {
		marker
			.closePopup()
			.bindPopup(
				L.popup({
					maxWidth: 250,
					minWidth: 100,
					autoClose: false,
					closeOnClick: false,
					className: `${workout.name}-popup`,
				})
			)
			.setPopupContent(
				`${workout.name === "running" ? "🏃‍♂️" : "🚴‍♀️"} ${
					workout.description
				}`
			)
			.openPopup();
	}

	_moveToPopup(e) {
		const workoutEl = e.target.closest(".workout");
		if (!workoutEl) {
			return;
		}

		const workoutIndex = this.#workouts.findIndex(
			(work) => work.id === workoutEl.dataset.id
		);

		const workout = this.#workouts[workoutIndex];

		// Edit workout option
		if (e.target.closest(".workout__edit")) {
			this._editWorkout(workoutIndex, workoutEl);
		} else {
			this._hideForm();
		}

		if (e.target.closest(".workout__delete")) {
			this._deleteWorkout(workoutEl, workoutIndex);
		}

		this.#map.setView(workout.coords, this.#mapZoomLevel, {
			animate: true,
			pan: {
				duration: 1,
			},
		});

		// using public interface
		// workout.click();
	}

	_setLocalStorage() {
		localStorage.setItem("workouts", JSON.stringify(this.#workouts));
	}

	_getLocalstorage() {
		const data = JSON.parse(localStorage.getItem("workouts"));

		if (!data) {
			return;
		}

		this.#workouts.push(...data);

		this.#workouts.forEach((work) => {
			this._renderWorkout(work);
		});
	}

	_editWorkout(workoutIndex, workoutElement) {
		const rerenderWorkoutMaker = (workout) => {
			this._createPopup(this.#markers[workoutIndex], workout);
		};

		const reRenderWoukout = () => {
			workoutElement.innerHTML = this._renderWorkout(
				this.#workouts[workoutIndex],
				true
			);
			workoutElement.className = `workout workout--${
				this.#workouts[workoutIndex].name
			}`;
		};

		const editFormHandler = (e) => {
			if (e.key !== "Enter") return;

			e.preventDefault();
			e.stopImmediatePropagation();

			const workoutPos = this.#workouts[workoutIndex].coords,
				workoutId = this.#workouts[workoutIndex].id,
				time = this.#workouts[workoutIndex].date;

			this.#workouts[workoutIndex] = this._createWorkout(
				workoutPos,
				time,
				workoutId
			);
			// workout workout--${workout.name}
			reRenderWoukout();
			rerenderWorkoutMaker(this.#workouts[workoutIndex]);
			form.removeEventListener("keydown", editFormHandler);
			this._setLocalStorage();

			this._hideForm();
		};

		form.classList.remove("hidden");

		form.addEventListener("keydown", editFormHandler);
	}

	_deleteWorkout(element, workoutIndex) {
		element.remove();
		this.#workouts.splice(workoutIndex, 1);
		this.#map.removeLayer(this.#markers[workoutIndex]);
		this.#markers.splice(workoutIndex, 1);
		this._setLocalStorage();
	}

	reset() {
		localStorage.removeItem("workouts");
		location.reload();
	}
}

const app = new App();
