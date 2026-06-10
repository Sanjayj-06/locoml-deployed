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
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

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
  const [showPassword, setShowPassword] = useState(false);

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
        background: "linear-gradient(135deg, #f4f3ef 0%, #e9e7e1 100%)",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Outfit', 'Helvetica Neue', Arial, sans-serif",
        color: "#2c2c2c",
        overflowX: "hidden",
        padding: "40px 0"
      }}
    >
      <style>{`
        /* Load Aalto OpenType Display Font */
        @font-face {
          font-family: 'Aalto Display-Personal-use';
          src: url('https://db.onlinewebfonts.com/t/f6ec291f284d1c8ba5a1706ba94e4a9d.woff2') format('woff2'),
               url('https://db.onlinewebfonts.com/t/f6ec291f284d1c8ba5a1706ba94e4a9d.woff') format('woff'),
               url('https://db.onlinewebfonts.com/t/f6ec291f284d1c8ba5a1706ba94e4a9d.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
        }

        /* Autofill overrides to match input fields */
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px #ffffff inset !important;
          -webkit-text-fill-color: #2c2c2c !important;
          transition: background-color 5000s ease-in-out 0s;
        }
        
        /* Focus state helper */
        .custom-input-group {
          border: 1px solid rgba(0, 0, 0, 0.15) !important;
          background: #ffffff !important;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        
        .custom-input-group:focus-within {
          border-color: #2dce89 !important;
          box-shadow: 0 0 0 3px rgba(45, 206, 137, 0.15) !important;
        }
      `}</style>

      <Container>
        <Row className="justify-content-center">
          <Col lg="5" md="7">
            <Card
              className="shadow border-0"
              style={{
                background: "#ffffff",
                border: "1px solid rgba(0, 0, 0, 0.08)",
                borderRadius: "16px",
                padding: "20px 10px",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.05)"
              }}
            >
              <CardBody className="px-lg-5 py-lg-5">
                <div className="text-center mb-4">
                  <h2 style={{ 
                    fontSize: "56px", 
                    fontWeight: "normal", 
                    fontFamily: "'Aalto Display-Personal-use', sans-serif",
                    margin: "0", 
                    color: "#2c2c2c",
                    lineHeight: "1.1"
                  }}>
                    LoCoML
                  </h2>
                  <p style={{ color: "#66615b", fontSize: "14px", marginTop: "10px" }}>
                    Create your personal developer profile
                  </p>
                </div>

                {error && (
                  <Alert
                    color="danger"
                    style={{
                      background: "rgba(239, 129, 87, 0.1)",
                      border: "1px solid rgba(239, 129, 87, 0.25)",
                      color: "#ef8157",
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
                      background: "rgba(45, 206, 137, 0.1)",
                      border: "1px solid rgba(45, 206, 137, 0.25)",
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
                    <label style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", color: "#66615b", fontWeight: "600", marginBottom: "8px" }}>
                      Full Name
                    </label>
                    <InputGroup className="custom-input-group" style={{ borderRadius: "10px", overflow: "hidden" }}>
                      <Input
                        placeholder="Enter full name"
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#2c2c2c",
                          height: "45px",
                          paddingLeft: "15px"
                        }}
                      />
                    </InputGroup>
                  </FormGroup>

                  <FormGroup className="mb-3">
                    <label style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", color: "#66615b", fontWeight: "600", marginBottom: "8px" }}>
                      Username
                    </label>
                    <InputGroup className="custom-input-group" style={{ borderRadius: "10px", overflow: "hidden" }}>
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
                          color: "#2c2c2c",
                          height: "45px",
                          paddingLeft: "15px"
                        }}
                      />
                    </InputGroup>
                  </FormGroup>

                  <FormGroup className="mb-3">
                    <label style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", color: "#66615b", fontWeight: "600", marginBottom: "8px" }}>
                      Email Address
                    </label>
                    <InputGroup className="custom-input-group" style={{ borderRadius: "10px", overflow: "hidden" }}>
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
                          color: "#2c2c2c",
                          height: "45px",
                          paddingLeft: "15px"
                        }}
                      />
                    </InputGroup>
                  </FormGroup>

                  <FormGroup className="mb-4">
                    <label style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", color: "#66615b", fontWeight: "600", marginBottom: "8px" }}>
                      Password
                    </label>
                    <InputGroup className="custom-input-group" style={{ borderRadius: "10px", overflow: "hidden" }}>
                      <Input
                        placeholder="Choose password"
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        autoComplete="on"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#2c2c2c",
                          height: "45px",
                          paddingLeft: "15px"
                        }}
                      />
                      <InputGroupText
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#66615b",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          paddingRight: "15px"
                        }}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <VisibilityOff style={{ fontSize: "20px" }} />
                        ) : (
                          <Visibility style={{ fontSize: "20px" }} />
                        )}
                      </InputGroupText>
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
                        fontWeight: "700",
                        borderRadius: "10px",
                        background: "transparent",
                        border: "2px solid #2dce89",
                        color: "#2dce89",
                        boxShadow: "none",
                        transition: "all 0.2s ease-in-out"
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = "#2dce89";
                        e.currentTarget.style.color = "#ffffff";
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow = "0 4px 15px rgba(45, 206, 137, 0.2)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "#2dce89";
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      {loading ? "Registering..." : "Create Account"}
                    </Button>
                  </div>
                </Form>

                <div className="text-center mt-4" style={{ fontSize: "14px" }}>
                  <span style={{ color: "#66615b" }}>Already have an account? </span>
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
