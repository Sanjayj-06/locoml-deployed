import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Button,
  Card,
  CardBody,
  FormGroup,
  Form,
  Input,
  InputGroup,
  InputGroupText,
  Container,
  Row,
  Col,
  Alert
} from "reactstrap";

function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    name: ""
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await axios.post(`${apiBaseUrl}/api/auth/signup`, {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        name: formData.name
      });

      if (response.data && response.data.success) {
        setSuccess("Registration successful! Logging you in...");
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));
        
        setTimeout(() => {
          navigate("/dashboard");
        }, 1500);
      } else {
        setError(response.data.error || "Registration failed");
      }
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError("Network error. Please make sure the backend server is running.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0f0c1b 0%, #201a30 50%, #0f0c1b 100%)",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Outfit', 'Helvetica Neue', Arial, sans-serif",
        color: "#ffffff",
        overflowX: "hidden",
        padding: "40px 0"
      }}
    >
      <Container>
        <Row className="justify-content-center">
          <Col lg="5" md="7">
            <Card
              className="shadow border-0"
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "20px",
                padding: "20px 10px",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)"
              }}
            >
              <CardBody className="px-lg-5 py-lg-5">
                <div className="text-center mb-4">
                  <div
                    style={{
                      width: "60px",
                      height: "60px",
                      background: "linear-gradient(45deg, #2dce89, #2dcecc)",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 15px auto",
                      boxShadow: "0 4px 15px rgba(45, 206, 137, 0.3)",
                      fontSize: "24px"
                    }}
                  >
                    <i className="nc-icon nc-badge" />
                  </div>
                  <h2 style={{ fontSize: "28px", fontWeight: "700", letterSpacing: "0.5px", margin: "0" }}>
                    LoCoML
                  </h2>
                  <p style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "14px", marginTop: "5px" }}>
                    Create your personal developer profile
                  </p>
                </div>

                {error && (
                  <Alert
                    color="danger"
                    style={{
                      background: "rgba(245, 54, 92, 0.15)",
                      border: "1px solid rgba(245, 54, 92, 0.3)",
                      color: "#f5365c",
                      borderRadius: "10px",
                      fontSize: "14px"
                    }}
                  >
                    {error}
                  </Alert>
                )}

                {success && (
                  <Alert
                    color="success"
                    style={{
                      background: "rgba(45, 206, 137, 0.15)",
                      border: "1px solid rgba(45, 206, 137, 0.3)",
                      color: "#2dce89",
                      borderRadius: "10px",
                      fontSize: "14px"
                    }}
                  >
                    {success}
                  </Alert>
                )}

                <Form role="form" onSubmit={handleSubmit}>
                  <FormGroup className="mb-3">
                    <label style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", color: "rgba(255, 255, 255, 0.5)", fontWeight: "600", marginBottom: "8px" }}>
                      Full Name
                    </label>
                    <InputGroup
                      style={{
                        background: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: "10px",
                        overflow: "hidden",
                        transition: "all 0.3s"
                      }}
                    >
                      <InputGroupText
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "rgba(255, 255, 255, 0.4)"
                        }}
                      >
                        <i className="nc-icon nc-circle-10" />
                      </InputGroupText>
                      <Input
                        placeholder="Enter full name"
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#ffffff",
                          height: "45px"
                        }}
                      />
                    </InputGroup>
                  </FormGroup>

                  <FormGroup className="mb-3">
                    <label style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", color: "rgba(255, 255, 255, 0.5)", fontWeight: "600", marginBottom: "8px" }}>
                      Username
                    </label>
                    <InputGroup
                      style={{
                        background: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: "10px",
                        overflow: "hidden",
                        transition: "all 0.3s"
                      }}
                    >
                      <InputGroupText
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "rgba(255, 255, 255, 0.4)"
                        }}
                      >
                        <i className="nc-icon nc-single-02" />
                      </InputGroupText>
                      <Input
                        placeholder="Choose username"
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        required
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#ffffff",
                          height: "45px"
                        }}
                      />
                    </InputGroup>
                  </FormGroup>

                  <FormGroup className="mb-3">
                    <label style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", color: "rgba(255, 255, 255, 0.5)", fontWeight: "600", marginBottom: "8px" }}>
                      Email Address
                    </label>
                    <InputGroup
                      style={{
                        background: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: "10px",
                        overflow: "hidden",
                        transition: "all 0.3s"
                      }}
                    >
                      <InputGroupText
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "rgba(255, 255, 255, 0.4)"
                        }}
                      >
                        <i className="nc-icon nc-email-85" />
                      </InputGroupText>
                      <Input
                        placeholder="Enter email address"
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#ffffff",
                          height: "45px"
                        }}
                      />
                    </InputGroup>
                  </FormGroup>

                  <FormGroup className="mb-4">
                    <label style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", color: "rgba(255, 255, 255, 0.5)", fontWeight: "600", marginBottom: "8px" }}>
                      Password
                    </label>
                    <InputGroup
                      style={{
                        background: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: "10px",
                        overflow: "hidden",
                        transition: "all 0.3s"
                      }}
                    >
                      <InputGroupText
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "rgba(255, 255, 255, 0.4)"
                        }}
                      >
                        <i className="nc-icon nc-key-25" />
                      </InputGroupText>
                      <Input
                        placeholder="Choose password"
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        autoComplete="on"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#ffffff",
                          height: "45px"
                        }}
                      />
                    </InputGroup>
                  </FormGroup>

                  <div className="text-center">
                    <Button
                      color="success"
                      type="submit"
                      disabled={loading}
                      style={{
                        width: "100%",
                        padding: "12px",
                        fontSize: "16px",
                        fontWeight: "600",
                        borderRadius: "10px",
                        background: "linear-gradient(45deg, #2dce89, #2dcecc)",
                        border: "none",
                        boxShadow: "0 4px 15px rgba(45, 206, 137, 0.2)",
                        transition: "transform 0.2s, box-shadow 0.2s"
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 6px 20px rgba(45, 206, 137, 0.3)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 4px 15px rgba(45, 206, 137, 0.2)";
                      }}
                    >
                      {loading ? "Registering..." : "Create Account"}
                    </Button>
                  </div>
                </Form>

                <div className="text-center mt-4" style={{ fontSize: "14px" }}>
                  <span style={{ color: "rgba(255, 255, 255, 0.5)" }}>Already have an account? </span>
                  <Link
                    to="/login"
                    style={{
                      color: "#2dce89",
                      fontWeight: "600",
                      textDecoration: "none",
                      transition: "color 0.2s"
                    }}
                    onMouseOver={(e) => e.currentTarget.style.color = "#2dcecc"}
                    onMouseOut={(e) => e.currentTarget.style.color = "#2dce89"}
                  >
                    Login
                  </Link>
                </div>
              </CardBody>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default Register;
