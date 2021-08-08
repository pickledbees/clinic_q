const myInfo = {
  clientId: "",
  redirectUrl: "",
  authApiUrl: "",
  attributes: "",
  venueId: "",
};

$((_) => {
  window.onbeforeunload = () => true; //warn user when navigating away from page

  getMyInfoEnv();
  $("#indicator").hide();

  if (window.location.href.includes("venueId")) {
    let urlParams = new URLSearchParams(window.location.search);
    myInfo.venueId = urlParams.get("venueId");
  }

  if (
    window.location.href.includes("callback?") &&
    window.location.href.includes("code=")
  ) {
    let urlParams = new URLSearchParams(window.location.search);
    myInfo.venueId = urlParams.get("state");
    getMyInfoPersonData(urlParams.get("code"));
    $("#indicator").show();
  }

  renderForm();
});

function getMyInfoEnv() {
  $.ajax({
    url: "/myInfoEnv",
    data: {},
    type: "GET",
    success: (data, _, xhr) => {
      myInfo.clientId = data.clientId;
      myInfo.redirectUrl = data.redirectUrl;
      myInfo.authApiUrl = data.authApiUrl;
      myInfo.attributes = data.attributes;
    },
    error: errorCallback,
  });
}

function redirectToAuthMyInfo() {
  window.onbeforeunload = undefined; //clear warning

  const purpose = "prefill-form";
  const state = myInfo.venueId;
  window.location =
    myInfo.authApiUrl +
    "?client_id=" +
    myInfo.clientId +
    "&attributes=" +
    myInfo.attributes +
    "&purpose=" +
    purpose +
    "&state=" +
    encodeURIComponent(state) +
    "&redirect_uri=" +
    myInfo.redirectUrl;
}

function getMyInfoPersonData(authCode) {
  $.ajax({
    url: "/person",
    data: { authCode },
    type: "POST",
    success: (data) => {
      $("#indicator").hide();
      fillForm(data);
    },
    error: () => {
      $("#indicator").hide();
      errorCallback();
    },
  });
}

/**
 * Fills the form based on raw SingPass MyInfo Person API response body
 * form follows a standard person schema
 * @param data
 */
function fillForm(data) {
  console.log(data);
  //extract relevant fields
  let {
    uinfin: nric,
    name,
    mobileno,
    sex,
    race,
    nationality,
    dob,
    email,
    regadd,
  } = data;

  if (mobileno) {
    mobileno = str(mobileno.nbr);
  }

  if (regadd) {
    if (regadd.type === "SG") {
      const { country, block, building, floor, unit, street, postal } = regadd;
      regadd =
        str(country) === ""
          ? ""
          : str(block) +
            " " +
            str(building) +
            " \n" +
            "#" +
            str(floor) +
            "-" +
            str(unit) +
            " " +
            str(street) +
            " \n" +
            "Singapore " +
            str(postal);
    } else if (regadd.type === "Unformatted") {
      regadd = str(data.regadd.line1) + " \n" + str(data.regadd.line2);
    }
  }

  //fill form
  Object.entries({
    nric,
    name,
    mobileno,
    sex,
    race,
    nationality,
    dob,
    email,
    regadd,
  }).forEach(([key, value]) => {
    $(`#${key}`).val(str(value));
  });
}

/**
 * Submit form data, enforces that mobile number and NRIC fields be filled
 * data sent includes the venueId on top of person schema
 * on success, performs redirect to queue page with necessary data in query params
 */
//TODO: perform validation, set loader, create failure to fetch alert
function submit() {
  window.onbeforeunload = undefined; //clear warning

  let formData = {};

  $("#form")
    .serializeArray()
    .forEach(({ name, value }) => (formData[name] = value));

  const ok = confirm("Submit form?");
  if (!ok) return;

  $.ajax({
    url: "/submit",
    data: { ...formData, venueId: myInfo.venueId },
    type: "POST",
    success: (data) => {
      const { redirect, nric, mobileno, number, venueId } = data;
      window.location =
        redirect +
        "?nric=" +
        nric +
        "&mobileno=" +
        mobileno +
        "&number=" +
        number +
        "&venueId=" +
        venueId;
    },
    error: () => {
      window.onbeforeunload = () => true; //set warning back
      alert("failed to register, please try again");
      errorCallback();
    },
  });
}

function renderForm() {
  const form = $("#form");
  [
    labelInputPair("NRIC", "nric"),
    labelInputPair("Full Name", "name"),
    labelInputPair("Phone Number", "mobileno"),
    labelInputPair("Sex", "sex"),
    labelInputPair("Race", "race"),
    labelInputPair("Nationality", "nationality"),
    labelInputPair("Date of Birth", "dob"),
    labelInputPair("Email", "email"),
    labelInputPair("Address", "regadd"),
  ].forEach((fragment) => form.append(fragment));
}

function labelInputPair(labelText, name) {
  const div = document.createElement("div");
  const label = document.createElement("label");
  const input = document.createElement("input");
  label.innerText = labelText;
  label.setAttribute("for", name);
  input.type = "text";
  input.id = name;
  input.name = name;
  input.classList.add("form-control");
  div.appendChild(label);
  div.appendChild(input);
  div.classList.add("form-group");
  return div;
}

//function to extract value / description from MyInfo Person API response
function str(data) {
  if (!data) return null;
  if (data.value) return data.value;
  if (data.desc) return data.desc;
  if (typeof data === "string") return data;
  return "";
}

function errorCallback(xhr, status, error) {
  let err = JSON.parse(xhr.responseText);
  console.log(err.message);
}
