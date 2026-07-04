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
import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Collapse,
  Navbar,
  NavbarToggler,
  NavbarBrand,
  Nav,
  NavItem,
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  Container,
  InputGroup,
  InputGroupText,
  InputGroupAddon,
  Input,
} from "reactstrap";

import routes from "routes.js";
import axios from "axios";

function Header(props) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [color, setColor] = React.useState("transparent");
  const [systemStatus, setSystemStatus] = React.useState("Connecting...");
  const sidebarToggle = React.useRef();
  const location = useLocation();
  const toggle = () => {
    if (isOpen) {
      setColor("transparent");
    } else {
      setColor("dark");
    }
    setIsOpen(!isOpen);
  };
  const dropdownToggle = (e) => {
    setDropdownOpen(!dropdownOpen);
  };
  const [profileDropdownOpen, setProfileDropdownOpen] = React.useState(false);
  const profileDropdownToggle = (e) => {
    setProfileDropdownOpen(!profileDropdownOpen);
  };
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  };
  const getBrand = () => {
    let brandName = "Default Brand";
    routes.map((prop, key) => {
      const regex = new RegExp(`^${prop.path.replace(/:[^\s/]+/g, "([\\w-]+)")}$`);
      if (regex.test(window.location.pathname)) {
        brandName = prop.name;
      }
      return null;
    });
    return brandName;
  };
  // const getBrand = () => {
  //   let brandName = "Default Brand";
  //   routes.map((prop, key) => {
  //     // console.log(prop.path, window.location.href)
  //     if (window.location.href.indexOf(prop.path) !== -1) {
  //       brandName = prop.name;
  //     }
  //     return null;
  //   });
  //   return brandName;
  // };
  const openSidebar = () => {
    document.documentElement.classList.toggle("nav-open");
    sidebarToggle.current.classList.toggle("toggled");
  };
  // function that adds color dark/transparent to the navbar on resize (this is for the collapse)
  const updateColor = () => {
    if (window.innerWidth < 993 && isOpen) {
      setColor("dark");
    } else {
      setColor("transparent");
    }
  };
  React.useEffect(() => {
    window.addEventListener("resize", updateColor.bind(this));
  });
  React.useEffect(() => {
    if (
      window.innerWidth < 993 &&
      document.documentElement.className.indexOf("nav-open") !== -1
    ) {
      document.documentElement.classList.toggle("nav-open");
      sidebarToggle.current.classList.toggle("toggled");
    }
  }, [location]);

  React.useEffect(() => {
    let isMounted = true;
    const checkStatus = async () => {
      try {
        const apiBase = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
        await axios.get(`${apiBase}/`);
        if (isMounted) setSystemStatus("System Online");
      } catch (error) {
        if (isMounted) setSystemStatus("Connecting...");
      }
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 15000); // Check every 15 seconds
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);
  return (
    // add or remove classes depending if we are on full-screen-maps page or not
    <Navbar
      color={
        location.pathname.indexOf("full-screen-maps") !== -1 ? "dark" : color
      }
      expand="lg"
      className={
        location.pathname.indexOf("full-screen-maps") !== -1
          ? "navbar-absolute fixed-top"
          : "navbar-absolute fixed-top " +
            (color === "transparent" ? "navbar-transparent " : "")
      }
    >
      <Container fluid>
        <div className="navbar-wrapper">
          <div className="navbar-toggle">
            <button
              type="button"
              ref={sidebarToggle}
              className="navbar-toggler"
              onClick={() => openSidebar()}
            >
              <span className="navbar-toggler-bar bar1" />
              <span className="navbar-toggler-bar bar2" />
              <span className="navbar-toggler-bar bar3" />
            </button>
          </div>
          <NavbarBrand href="/">{getBrand()}</NavbarBrand>
        </div>
        <NavbarToggler onClick={toggle}>
          <span className="navbar-toggler-bar navbar-kebab" />
          <span className="navbar-toggler-bar navbar-kebab" />
          <span className="navbar-toggler-bar navbar-kebab" />
        </NavbarToggler>
        <Collapse isOpen={isOpen} navbar className="justify-content-end">
          <Nav navbar>
            <style>
              {`
                @keyframes blink {
                  0% { opacity: 1; }
                  50% { opacity: 0.4; }
                  100% { opacity: 1; }
                }
              `}
            </style>
            <NavItem className="d-flex align-items-center mr-3">
              <div 
                className="btn btn-sm m-0" 
                style={{
                  backgroundColor: systemStatus === "System Online" ? "#28a745" : "#ffc107",
                  color: systemStatus === "System Online" ? "white" : "#333",
                  borderRadius: "20px",
                  pointerEvents: "none",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  padding: "5px 15px",
                  border: "none",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                }}
              >
                <div style={{
                  width: "8px", 
                  height: "8px", 
                  borderRadius: "50%", 
                  backgroundColor: systemStatus === "System Online" ? "#fff" : "#333",
                  marginRight: "8px",
                  animation: systemStatus === "Connecting..." ? "blink 1.5s infinite" : "none"
                }} />
                {systemStatus}
              </div>
            </NavItem>
            {/* <NavItem>
              <Link to="#pablo" className="nav-link btn-magnify">
                <i className="nc-icon nc-layout-11" />
                <p>
                  <span className="d-lg-none d-md-block">Stats</span>
                </p>
              </Link>
            </NavItem> */}
            <Dropdown
              nav
              isOpen={dropdownOpen}
              toggle={(e) => dropdownToggle(e)}
            >
              <DropdownToggle caret nav>
                <i className="nc-icon nc-bell-55" />
                <p>
                  <span className="d-lg-none d-md-block">Some Actions</span>
                </p>
              </DropdownToggle>
              <DropdownMenu right>
                <DropdownItem tag="a">Action</DropdownItem>
                <DropdownItem tag="a">Another Action</DropdownItem>
                <DropdownItem tag="a">Something else here</DropdownItem>
              </DropdownMenu>
            </Dropdown>
            <Dropdown
              nav
              isOpen={profileDropdownOpen}
              toggle={(e) => profileDropdownToggle(e)}
            >
              <DropdownToggle caret nav className="nav-link btn-rotate">
                <i className="nc-icon nc-settings-gear-65" />
                <p>
                  <span className="d-lg-none d-md-block">Account</span>
                </p>
              </DropdownToggle>
              <DropdownMenu right>
                <DropdownItem tag={Link} to="/user-profile">
                  <i className="nc-icon nc-single-02 mr-2" /> My Profile
                </DropdownItem>
                <DropdownItem divider />
                <DropdownItem onClick={handleLogout} style={{ color: "#f5365c" }}>
                  <i className="nc-icon nc-button-power mr-2" /> Logout
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </Nav>
        </Collapse>
      </Container>
    </Navbar>
  );
}

export default Header;
