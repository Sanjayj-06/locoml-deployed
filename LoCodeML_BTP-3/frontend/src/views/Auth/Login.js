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

function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: "",
    password: ""
  });
  const [error, setError] = useState("");
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
    setLoading(true);

    try {
      const response = await axios.post(`${apiBaseUrl}/api/auth/login`, {
        username: formData.username,
        password: formData.password
      });

      if (response.data && response.data.success) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));
        navigate("/dashboard");
      } else {
        setError(response.data.error || "Login failed");
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
        overflowX: "hidden"
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
                      background: "linear-gradient(45deg, #11cdef, #1171ef)",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 15px auto",
                      boxShadow: "0 4px 15px rgba(17, 205, 239, 0.3)",
                      fontSize: "24px"
                    }}
                  >
                    <i className="nc-icon nc-sound-wave" />
                  </div>
                  <h2 style={{ fontSize: "28px", fontWeight: "700", letterSpacing: "0.5px", margin: "0" }}>
                    LoCoML
                  </h2>
                  <p style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "14px", marginTop: "5px" }}>
                    Sign in to your private AutoML workspace
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

                <Form role="form" onSubmit={handleSubmit}>
                  <FormGroup className="mb-3">
                    <label style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", color: "rgba(255, 255, 255, 0.5)", fontWeight: "600", marginBottom: "8px" }}>
                      Username or Email
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
                        placeholder="Enter username or email"
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
                        placeholder="Enter password"
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
                      color="info"
                      type="submit"
                      disabled={loading}
                      style={{
                        width: "100%",
                        padding: "12px",
                        fontSize: "16px",
                        fontWeight: "600",
                        borderRadius: "10px",
                        background: "linear-gradient(45deg, #11cdef, #1171ef)",
                        border: "none",
                        boxShadow: "0 4px 15px rgba(17, 205, 239, 0.2)",
                        transition: "transform 0.2s, box-shadow 0.2s"
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 6px 20px rgba(17, 205, 239, 0.3)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 4px 15px rgba(17, 205, 239, 0.2)";
                      }}
                    >
                      {loading ? "Signing In..." : "Sign In"}
                    </Button>
                  </div>
                </Form>

                <div className="text-center mt-4" style={{ fontSize: "14px" }}>
                  <span style={{ color: "rgba(255, 255, 255, 0.5)" }}>Don't have an account? </span>
                  <Link
                    to="/register"
                    style={{
                      color: "#11cdef",
                      fontWeight: "600",
                      textDecoration: "none",
                      transition: "color 0.2s"
                    }}
                    onMouseOver={(e) => e.currentTarget.style.color = "#1171ef"}
                    onMouseOut={(e) => e.currentTarget.style.color = "#11cdef"}
                  >
                    Register
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

export default Login;
