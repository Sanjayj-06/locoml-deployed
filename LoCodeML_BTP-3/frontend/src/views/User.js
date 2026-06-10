/*!

=========================================================
* Paper Dashboard React - v1.3.2
=========================================================

* Product Page: https://www.creative-tim.com/product/paper-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

* Licensed under MIT (https://github.com/creativetimofficial/paper-dashboard-react/blob/main/LICENSE.md)

* Coded by Creative Tim

=========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

*/
import React, { useState, useEffect } from "react";
import axios from "axios";

// reactstrap components
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  CardTitle,
  FormGroup,
  Form,
  Input,
  Row,
  Col,
  Alert
} from "reactstrap";

function User() {
  const [profileData, setProfileData] = useState({
    username: "",
    email: "",
    firstName: "",
    lastName: "",
    company: "",
    address: "",
    city: "",
    country: "",
    postalCode: "",
    aboutMe: ""
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [avatarSrc, setAvatarSrc] = useState("");

  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

  useEffect(() => {
    const savedPic = localStorage.getItem("user_profile_pic");
    if (savedPic) {
      setAvatarSrc(savedPic);
    }
  }, []);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        localStorage.setItem("user_profile_pic", base64String);
        setAvatarSrc(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get(`${apiBaseUrl}/api/auth/profile`);
        if (response.data && response.data.success) {
          const u = response.data.user;
          const nameParts = (u.name || "").split(" ");
          const firstName = nameParts[0] || "";
          const lastName = nameParts.slice(1).join(" ") || "";
          setProfileData({
            username: u.username || "",
            email: u.email || "",
            firstName: firstName,
            lastName: lastName,
            company: u.company || "",
            address: u.address || "",
            city: u.city || "",
            country: u.country || "",
            postalCode: u.postal_code || "",
            aboutMe: u.about_me || ""
          });
        }
      } catch (err) {
        console.error("Error fetching user profile:", err);
        setError("Could not load profile details from backend.");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [apiBaseUrl]);

  const handleChange = (e) => {
    setProfileData({
      ...profileData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    
    try {
      const fullName = `${profileData.firstName} ${profileData.lastName}`.trim();
      const response = await axios.put(`${apiBaseUrl}/api/auth/profile`, {
        name: fullName,
        company: profileData.company,
        address: profileData.address,
        city: profileData.city,
        country: profileData.country,
        postal_code: profileData.postalCode,
        about_me: profileData.aboutMe
      });

      if (response.data && response.data.success) {
        localStorage.setItem("user", JSON.stringify(response.data.user));
        setMessage("Profile updated successfully!");
      } else {
        setError(response.data.error || "Update failed");
      }
    } catch (err) {
      console.error("Error updating user profile:", err);
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError("Failed to save profile changes.");
      }
    }
  };

  if (loading) {
    return (
      <div className="content text-center py-5">
        <h4>Loading Profile...</h4>
      </div>
    );
  }

  return (
    <>
      <div className="content">
        <Row>
          <Col md="4">
            <Card className="card-user">
              <div className="image">
                <img alt="..." src={require("assets/img/damir-bosnjak.jpg")} />
              </div>
              <CardBody>
                <div className="author">
                  <a href="#pablo" onClick={(e) => e.preventDefault()}>
                    <img
                      alt="..."
                      className="avatar border-gray"
                      src={avatarSrc || require("assets/img/mike.jpg")}
                      style={{ cursor: "pointer" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const inputEl = document.getElementById("avatar-upload");
                        if (inputEl) {
                          inputEl.click();
                        }
                      }}
                      title="Click to change profile picture"
                    />
                    <h5 className="title">
                      {profileData.firstName || profileData.lastName
                        ? `${profileData.firstName} ${profileData.lastName}`.trim()
                        : profileData.username}
                    </h5>
                  </a>
                  <input
                    type="file"
                    id="avatar-upload"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleAvatarChange}
                  />
                  <p className="description">@{profileData.username}</p>
                </div>
                <p className="description text-center">
                  "{profileData.aboutMe || "Add an about me bio details by updating your profile!"}"
                </p>
              </CardBody>
              <CardFooter>
                <hr />
                <div className="button-container">
                  <Row>
                    <Col className="ml-auto mr-auto" lg="6" md="6" xs="6">
                      <h5>
                        LoCoML <br />
                        <small>AutoML Workspace</small>
                      </h5>
                    </Col>
                  </Row>
                </div>
              </CardFooter>
            </Card>
          </Col>
          <Col md="8">
            <Card className="card-user">
              <CardHeader>
                <CardTitle tag="h5">Edit Profile</CardTitle>
              </CardHeader>
              <CardBody>
                {message && <Alert color="success">{message}</Alert>}
                {error && <Alert color="danger">{error}</Alert>}
                <Form onSubmit={handleSubmit}>
                  <Row>
                    <Col className="pr-1" md="5">
                      <FormGroup>
                        <label>Company</label>
                        <Input
                          name="company"
                          value={profileData.company}
                          onChange={handleChange}
                          placeholder="Company"
                          type="text"
                        />
                      </FormGroup>
                    </Col>
                    <Col className="px-1" md="3">
                      <FormGroup>
                        <label>Username (disabled)</label>
                        <Input
                          value={profileData.username}
                          disabled
                          placeholder="Username"
                          type="text"
                        />
                      </FormGroup>
                    </Col>
                    <Col className="pl-1" md="4">
                      <FormGroup>
                        <label htmlFor="exampleInputEmail1">
                          Email address (disabled)
                        </label>
                        <Input
                          value={profileData.email}
                          disabled
                          placeholder="Email"
                          type="email"
                        />
                      </FormGroup>
                    </Col>
                  </Row>
                  <Row>
                    <Col className="pr-1" md="6">
                      <FormGroup>
                        <label>First Name</label>
                        <Input
                          name="firstName"
                          value={profileData.firstName}
                          onChange={handleChange}
                          placeholder="First Name"
                          type="text"
                        />
                      </FormGroup>
                    </Col>
                    <Col className="pl-1" md="6">
                      <FormGroup>
                        <label>Last Name</label>
                        <Input
                          name="lastName"
                          value={profileData.lastName}
                          onChange={handleChange}
                          placeholder="Last Name"
                          type="text"
                        />
                      </FormGroup>
                    </Col>
                  </Row>
                  <Row>
                    <Col md="12">
                      <FormGroup>
                        <label>Address</label>
                        <Input
                          name="address"
                          value={profileData.address}
                          onChange={handleChange}
                          placeholder="Home Address"
                          type="text"
                        />
                      </FormGroup>
                    </Col>
                  </Row>
                  <Row>
                    <Col className="pr-1" md="4">
                      <FormGroup>
                        <label>City</label>
                        <Input
                          name="city"
                          value={profileData.city}
                          onChange={handleChange}
                          placeholder="City"
                          type="text"
                        />
                      </FormGroup>
                    </Col>
                    <Col className="px-1" md="4">
                      <FormGroup>
                        <label>Country</label>
                        <Input
                          name="country"
                          value={profileData.country}
                          onChange={handleChange}
                          placeholder="Country"
                          type="text"
                        />
                      </FormGroup>
                    </Col>
                    <Col className="pl-1" md="4">
                      <FormGroup>
                        <label>Postal Code</label>
                        <Input
                          name="postalCode"
                          value={profileData.postalCode}
                          onChange={handleChange}
                          placeholder="ZIP Code"
                          type="text"
                        />
                      </FormGroup>
                    </Col>
                  </Row>
                  <Row>
                    <Col md="12">
                      <FormGroup>
                        <label>About Me</label>
                        <Input
                          name="aboutMe"
                          value={profileData.aboutMe}
                          onChange={handleChange}
                          type="textarea"
                          placeholder="Enter details about yourself..."
                        />
                      </FormGroup>
                    </Col>
                  </Row>
                  <Row>
                    <div className="update ml-auto mr-auto">
                      <Button
                        className="btn-round"
                        color="primary"
                        type="submit"
                      >
                        Update Profile
                      </Button>
                    </div>
                  </Row>
                </Form>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </div>
    </>
  );
}

export default User;
